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

export async function register(email: string, password: string): Promise<{ message: string }> {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) throw createError('Ya existe una cuenta con ese correo', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const [user] = await query<AuthUser>(
    `INSERT INTO users (email, password_hash, role, email_verified, verification_token, verification_token_expires_at)
     VALUES ($1, $2, 'client', FALSE, $3, $4)
     RETURNING id, email, role, is_active, email_verified, created_at`,
    [email, passwordHash, verificationToken, expiresAt],
  );

  await query(
    `INSERT INTO client_profiles (user_id, business_name)
     VALUES ($1, '')`,
    [user.id],
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
    throw createError('El link de verificación expiró. Por favor regístrate de nuevo.', 400);
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

export async function login(email: string, password: string): Promise<LoginResult> {
  const row = await queryOne<AuthUser & { password_hash: string }>(
    'SELECT id, email, role, is_active, email_verified, created_at, password_hash FROM users WHERE email = $1',
    [email],
  );

  if (!row) throw createError('Credenciales incorrectas', 401);
  if (!row.is_active) throw createError('Cuenta desactivada', 403);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw createError('Credenciales incorrectas', 401);

  if (!row.email_verified) {
    throw createError('Por favor verifica tu email antes de iniciar sesión', 403);
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
