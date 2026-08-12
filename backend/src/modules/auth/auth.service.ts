import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { query, queryOne } from '../../config/database';
import { env } from '../../config/env';
import { createError } from '../../middleware/errorHandler';

const resend = new Resend(env.RESEND_API_KEY || 're_test_placeholder');

export interface AuthUser {
  id:             string;
  email:          string;
  role:           'client' | 'admin';
  is_active:      boolean;
  email_verified: boolean;
  created_at:     string;
}

export interface LoginResult {
  token: string;
  user:  AuthUser;
}

// In-memory rate limiter for resend-verification: max 3 per email per 15 min
const resendRateLimiter = new Map<string, { count: number; windowStart: number }>();
const RESEND_LIMIT      = 3;
const RESEND_WINDOW_MS  = 15 * 60 * 1000;

// In-memory rate limiter for login: max 5 failed attempts per (IP, email) pair
// per 15 min — brute-force protection. Keyed on IP+email together (not IP alone)
// so one attacker guessing against one email can't lock out everyone else behind
// the same NAT/office IP. Only failed attempts (wrong email or wrong password)
// increment the counter; a successful password match clears it immediately.
//
// LIMITATION: this is process-local memory, same pattern as resendRateLimiter
// above — it resets on every backend restart/redeploy, and would NOT be shared
// across instances if this service is ever horizontally scaled (a distributed
// attacker or multiple backend instances behind a load balancer would each get
// their own independent counter). Fine for the current single-instance
// deployment; revisit with Redis (or a DB-backed table) if that changes.
const loginRateLimiter = new Map<string, { count: number; windowStart: number }>();
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_WINDOW_MS     = 15 * 60 * 1000;

function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`;
}

function isLoginRateLimited(ip: string, email: string): boolean {
  const entry = loginRateLimiter.get(loginRateLimitKey(ip, email));
  if (!entry) return false;
  if (Date.now() - entry.windowStart >= LOGIN_WINDOW_MS) return false;
  return entry.count >= LOGIN_ATTEMPT_LIMIT;
}

function registerFailedLogin(ip: string, email: string): void {
  const key   = loginRateLimitKey(ip, email);
  const now   = Date.now();
  const entry = loginRateLimiter.get(key);

  if (entry && now - entry.windowStart < LOGIN_WINDOW_MS) {
    entry.count++;
  } else {
    loginRateLimiter.set(key, { count: 1, windowStart: now });
  }
}

function clearLoginRateLimit(ip: string, email: string): void {
  loginRateLimiter.delete(loginRateLimitKey(ip, email));
}

export async function register(
  email:          string,
  password:       string,
  registrationIp?: string,
): Promise<{ message: string }> {
  const existing = await queryOne<{ id: string; email_verified: boolean }>(
    'SELECT id, email_verified FROM users WHERE email = $1', [email],
  );
  if (existing) {
    if (!existing.email_verified) {
      throw createError(
        'Ya existe una cuenta con este correo pendiente de verificación. Reenvía el email de verificación.',
        409,
        'EMAIL_EXISTS_UNVERIFIED',
      );
    }
    throw createError('Ya existe una cuenta con ese correo', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const [user] = await query<AuthUser>(
    `INSERT INTO users (email, password_hash, role, email_verified, verification_token, verification_token_expires_at)
     VALUES ($1, $2, 'client', FALSE, $3, $4)
     RETURNING id, email, role, is_active, email_verified, created_at`,
    [email, passwordHash, verificationToken, expiresAt],
  );

  // Every new client enters trial mode automatically — skips both plan
  // selection and delivery-mode selection (delivery_mode defaults to
  // 'manual') until they exhaust their trial posts or convert to a paid
  // plan via /select-plan (which clears is_trial and delivery_mode again
  // so the real onboarding gates re-engage for the paid flow).
  await query(
    `INSERT INTO client_profiles
       (user_id, business_name, plan_selected_at, delivery_mode, is_trial, registration_ip)
     VALUES ($1, '', NOW(), 'manual', TRUE, $2)`,
    [user.id, registrationIp ?? null],
  );

  await sendVerificationEmail(email, verificationToken);

  return { message: 'Revisa tu email para verificar tu cuenta' };
}

export async function verifyEmail(token: string): Promise<LoginResult> {
  const row = await queryOne<AuthUser & { verification_token_expires_at: string }>(
    `SELECT id, email, role, is_active, email_verified, created_at, verification_token_expires_at
     FROM users
     WHERE verification_token = $1`,
    [token],
  );

  if (!row) throw createError('Token inválido o ya utilizado', 400);

  const expires = new Date(row.verification_token_expires_at);
  if (expires < new Date()) {
    throw createError('El link de verificación expiró. Solicita uno nuevo ingresando tu correo.', 400);
  }

  const [user] = await query<AuthUser>(
    `UPDATE users
     SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL
     WHERE id = $1
     RETURNING id, email, role, is_active, email_verified, created_at`,
    [row.id],
  );

  const jwtToken = signToken(user);
  return { token: jwtToken, user };
}

export async function login(email: string, password: string, ip: string): Promise<LoginResult> {
  // Checked first, before touching the DB — same generic message as a wrong
  // password below, so a client can't tell "you're rate-limited" apart from
  // "wrong credentials" from the response alone.
  if (isLoginRateLimited(ip, email)) {
    throw createError('Credenciales incorrectas', 401);
  }

  const row = await queryOne<AuthUser & { password_hash: string }>(
    'SELECT id, email, role, is_active, email_verified, created_at, password_hash FROM users WHERE email = $1',
    [email],
  );

  if (!row) {
    registerFailedLogin(ip, email);
    throw createError('Credenciales incorrectas', 401);
  }
  if (!row.is_active) throw createError('Cuenta desactivada', 403);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    registerFailedLogin(ip, email);
    throw createError('Credenciales incorrectas', 401);
  }

  // Correct password from here on — not a brute-force guess anymore, so clear
  // any prior failed attempts for this pair even if the login is about to be
  // blocked below for an unrelated reason (unverified email).
  clearLoginRateLimit(ip, email);

  if (!row.email_verified) {
    throw createError('Por favor verifica tu email antes de iniciar sesión', 403, 'EMAIL_UNVERIFIED');
  }

  const { password_hash: _, ...user } = row;
  const jwtToken = signToken(user);
  return { token: jwtToken, user };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await queryOne<AuthUser>(
    'SELECT id, email, role, is_active, email_verified, created_at FROM users WHERE id = $1',
    [userId],
  );
  if (!user) throw createError('Usuario no encontrado', 404);
  return user;
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const GENERIC = { message: 'Si el correo existe, te hemos enviado un nuevo link de verificación' };

  // Rate limit: max 3 attempts per email per 15 min
  const now  = Date.now();
  const key  = email.toLowerCase();
  const entry = resendRateLimiter.get(key);

  if (entry) {
    if (now - entry.windowStart < RESEND_WINDOW_MS) {
      if (entry.count >= RESEND_LIMIT) {
        throw createError('Demasiados intentos. Espera 15 minutos antes de volver a intentar.', 429);
      }
      entry.count++;
    } else {
      resendRateLimiter.set(key, { count: 1, windowStart: now });
    }
  } else {
    resendRateLimiter.set(key, { count: 1, windowStart: now });
  }

  const user = await queryOne<{ id: string; email_verified: boolean }>(
    'SELECT id, email_verified FROM users WHERE email = $1', [email],
  );

  if (!user || user.email_verified) return GENERIC;

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt         = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await query(
    `UPDATE users SET verification_token = $1, verification_token_expires_at = $2 WHERE id = $3`,
    [verificationToken, expiresAt, user.id],
  );

  await sendVerificationEmail(email, verificationToken);
  return GENERIC;
}

function signToken(user: AuthUser): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  const from = env.NODE_ENV === 'production'
    ? 'noreply@spotflow.pro'
    : 'onboarding@resend.dev';

  await resend.emails.send({
    from,
    to:      email,
    subject: 'Verifica tu cuenta en SpotFlow',
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">SpotFlow</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Automatizacion de Ads</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px">
            <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:20px;font-weight:600">Verifica tu cuenta</h2>
            <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.6">
              Gracias por registrarte en SpotFlow. Haz clic en el boton de abajo para verificar tu direccion de email y activar tu cuenta.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6)">
                  <a href="${verifyUrl}"
                     style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px">
                    Verificar mi email
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;color:#64748b;font-size:13px;line-height:1.5">
              Este enlace expira en <strong style="color:#94a3b8">24 horas</strong>.<br>
              Si no creaste esta cuenta, puedes ignorar este email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #334155">
            <p style="margin:0;color:#475569;font-size:12px">
              Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${verifyUrl}" style="color:#6366f1;word-break:break-all">${verifyUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
