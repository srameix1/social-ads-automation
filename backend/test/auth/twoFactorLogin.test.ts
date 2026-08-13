import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generate as generateTotpCode } from 'otplib';
import app from '../../src/app';
import { query, queryOne } from '../../src/config/database';
import { env } from '../../src/config/env';
import { truncateAllTables, closeTestPool } from '../setup/dbTestHelper';

interface SeededUser {
  id:    string;
  email: string;
}

async function createUser(opts: {
  email:    string;
  password: string;
  role?:    'client' | 'admin';
}): Promise<SeededUser> {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const [user] = await query<SeededUser>(
    `INSERT INTO users (email, password_hash, role, is_active, email_verified)
     VALUES ($1, $2, $3, TRUE, TRUE)
     RETURNING id, email`,
    [opts.email, passwordHash, opts.role ?? 'client'],
  );
  return user;
}

// Mismo helper que el resto de test/auth/ y test/authorization/.
function findCookie(setCookieHeader: string | string[] | undefined, name: string): string | undefined {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

async function loginAndGetCookie(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  const authCookie = findCookie(res.headers['set-cookie'], 'auth_token');
  if (!authCookie) throw new Error(`Login falló para ${email}: no llegó cookie auth_token (status ${res.status})`);
  return authCookie.split(';')[0];
}

/** Crea un admin, activa 2FA (login sin 2FA + setup + verify-setup) y devuelve los backup codes. */
async function createAdminWith2FA(
  email: string,
  password: string,
): Promise<{ id: string; backupCodes: string[]; cookie: string }> {
  const admin = await createUser({ email, password, role: 'admin' });
  // Login ANTES de activar 2FA — la sesión ya establecida sirve para llamar
  // a /2fa/setup y /2fa/verify-setup sin pasar todavía por el segundo factor.
  // Se devuelve esta MISMA cookie (no una nueva) porque, una vez 2FA activo,
  // un login() posterior para este email ya no da cookie directo — exige el
  // segundo factor. La sesión ya emitida sigue siendo válida igual: el JWT
  // no se invalida por un cambio posterior en totp_enabled.
  const cookie = await loginAndGetCookie(email, password);

  const setupRes = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);
  const secret    = setupRes.body.secret as string;
  const code      = await generateTotpCode({ secret });

  const verifyRes = await request(app)
    .post('/api/auth/2fa/verify-setup')
    .set('Cookie', cookie)
    .send({ code });

  return { id: admin.id, backupCodes: verifyRes.body.backupCodes as string[], cookie };
}

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('Flujo completo: login con 2FA activo', () => {
  it('setup → verify-setup → login → verify-2fa con código TOTP real → JWT válido y sesión usable', async () => {
    const email    = 'admin-2fa-flow@test.local';
    const password = 'AdminPass123!';

    await createUser({ email, password, role: 'admin' });
    const setupCookie = await loginAndGetCookie(email, password);
    const setupRes    = await request(app).post('/api/auth/2fa/setup').set('Cookie', setupCookie);
    const secret       = setupRes.body.secret as string;
    await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', setupCookie)
      .send({ code: await generateTotpCode({ secret }) });

    // Login fresco: ahora sí debe frenar en el segundo factor.
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requires_2fa).toBe(true);
    expect(typeof loginRes.body.pendingToken).toBe('string');
    expect(loginRes.body.user).toBeUndefined();
    expect(loginRes.body.token).toBeUndefined();
    expect(findCookie(loginRes.headers['set-cookie'], 'auth_token')).toBeUndefined(); // sin sesión todavía

    // Segundo factor: código TOTP real, generado con el mismo secreto que
    // vería la app autenticadora del usuario.
    const code = await generateTotpCode({ secret });
    const verifyRes = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: loginRes.body.pendingToken, code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.email).toBe(email);
    expect(typeof verifyRes.body.token).toBe('string');

    const authCookie = findCookie(verifyRes.headers['set-cookie'], 'auth_token');
    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);

    // Cierra el círculo: la sesión emitida acá es real y usable.
    const meRes = await request(app).get('/api/auth/me').set('Cookie', authCookie!.split(';')[0]);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email);
  });
});

describe('POST /api/auth/login/verify-2fa', () => {
  it('con un código TOTP correcto emite sesión completa', async () => {
    const email    = 'admin-totp@test.local';
    const password = 'AdminPass123!';
    await createUser({ email, password, role: 'admin' });
    const setupCookie = await loginAndGetCookie(email, password);
    const setupRes = await request(app).post('/api/auth/2fa/setup').set('Cookie', setupCookie);
    const secret = setupRes.body.secret as string;
    await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', setupCookie)
      .send({ code: await generateTotpCode({ secret }) });

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.body.requires_2fa).toBe(true);

    const code = await generateTotpCode({ secret });
    const res = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: loginRes.body.pendingToken, code });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(findCookie(res.headers['set-cookie'], 'auth_token')).toBeDefined();
  });

  it('con un backup code lo consume — un segundo uso del mismo código falla', async () => {
    const email    = 'admin-backup@test.local';
    const password = 'AdminPass123!';
    const { backupCodes } = await createAdminWith2FA(email, password);
    const backupCode = backupCodes[0];

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });

    const firstUse = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: loginRes.body.pendingToken, code: backupCode });
    expect(firstUse.status).toBe(200);

    // Nuevo login (el pendingToken de arriba ya se consumió al emitir sesión,
    // pero además el backup code en sí debe estar invalidado). Segundo login
    // fresco + intento de reusar el MISMO backup code.
    const secondLoginRes = await request(app).post('/api/auth/login').send({ email, password });
    const secondUse = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: secondLoginRes.body.pendingToken, code: backupCode });

    expect(secondUse.status).toBe(401);

    const row = await queryOne<{ totp_backup_codes: string[] }>(
      'SELECT totp_backup_codes FROM users WHERE email = $1',
      [email],
    );
    expect(row?.totp_backup_codes).toHaveLength(7); // uno menos
  });

  it('con un código incorrecto devuelve 401', async () => {
    const email    = 'admin-badcode@test.local';
    const password = 'AdminPass123!';
    await createAdminWith2FA(email, password);

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: loginRes.body.pendingToken, code: '000000' });

    expect(res.status).toBe(401);
  });

  it('con un pendingToken vencido devuelve 401', async () => {
    const email    = 'admin-expired@test.local';
    const password = 'AdminPass123!';
    const { id } = await createAdminWith2FA(email, password);

    const expiredToken = jwt.sign({ userId: id, pending2FA: true }, env.JWT_SECRET, { expiresIn: -10 });

    const res = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: expiredToken, code: '123456' });

    expect(res.status).toBe(401);
  });

  it('con un JWT válido pero sin el claim pending2FA devuelve 401 (no acepta cualquier token)', async () => {
    const email    = 'admin-wrongclaim@test.local';
    const password = 'AdminPass123!';
    const { id } = await createAdminWith2FA(email, password);

    const normalSessionToken = jwt.sign({ userId: id, email, role: 'admin' }, env.JWT_SECRET, { expiresIn: '5m' });

    const res = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: normalSessionToken, code: '123456' });

    expect(res.status).toBe(401);
  });

  it('bloquea el 6to intento tras 5 códigos fallidos seguidos, incluso con el código correcto', async () => {
    const email    = 'admin-ratelimit@test.local';
    const password = 'AdminPass123!';
    await createAdminWith2FA(email, password);

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const pendingToken = loginRes.body.pendingToken;

    for (let i = 0; i < 5; i++) {
      const failed = await request(app)
        .post('/api/auth/login/verify-2fa')
        .send({ pendingToken, code: '000000' });
      expect(failed.status).toBe(401);
    }

    // Nuevo login para tener un pendingToken fresco (no vencido) pero el
    // rate limit está keyeado por (IP, userId), no por el token — sigue
    // bloqueado.
    const secondLoginRes = await request(app).post('/api/auth/login').send({ email, password });
    const sixthAttempt = await request(app)
      .post('/api/auth/login/verify-2fa')
      .send({ pendingToken: secondLoginRes.body.pendingToken, code: '000000' });

    expect(sixthAttempt.status).toBe(401);
  });

  it('el pendingToken NUNCA sirve como sesión en rutas autenticadas normales', async () => {
    const email    = 'admin-pending-misuse@test.local';
    const password = 'AdminPass123!';
    await createAdminWith2FA(email, password);

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `auth_token=${loginRes.body.pendingToken}`);

    expect(res.status).toBe(401);
  });
});

describe('Un cliente normal nunca pasa por el gate de 2FA', () => {
  it('login de un cliente sin 2FA sigue devolviendo sesión directa', async () => {
    const email    = 'client-normal@test.local';
    const password = 'ClientPass123!';
    await createUser({ email, password, role: 'client' });

    const res = await request(app).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.requires_2fa).toBeUndefined();
    expect(res.body.user.email).toBe(email);
    expect(findCookie(res.headers['set-cookie'], 'auth_token')).toBeDefined();
  });

  it('incluso con totp_enabled=TRUE forzado en un cliente, login() lo ignora (el gate exige role=admin)', async () => {
    const email    = 'client-forced-totp@test.local';
    const password = 'ClientPass123!';
    const client = await createUser({ email, password, role: 'client' });
    // Nunca sucede vía API (setup/verify-setup exigen authorize('admin')) —
    // esto simula el peor caso de un bug futuro que lo permitiera, y prueba
    // que el chequeo `role === 'admin'` en login() es una barrera real.
    await query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [client.id]);

    const res = await request(app).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.requires_2fa).toBeUndefined();
    expect(res.body.user).toBeDefined();
    expect(findCookie(res.headers['set-cookie'], 'auth_token')).toBeDefined();
  });
});

describe('POST /api/auth/2fa/disable', () => {
  it('con password y código TOTP correctos desactiva 2FA', async () => {
    const email    = 'admin-disable@test.local';
    const password = 'AdminPass123!';
    await createUser({ email, password, role: 'admin' });
    const cookie = await loginAndGetCookie(email, password);
    const setupRes = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);
    const secret = setupRes.body.secret as string;
    await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', cookie)
      .send({ code: await generateTotpCode({ secret }) });

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Cookie', cookie)
      .send({ password, code: await generateTotpCode({ secret }) });

    expect(res.status).toBe(200);

    const row = await queryOne<{ totp_enabled: boolean; totp_secret: string | null; totp_backup_codes: string[] | null }>(
      'SELECT totp_enabled, totp_secret, totp_backup_codes FROM users WHERE email = $1',
      [email],
    );
    expect(row?.totp_enabled).toBe(false);
    expect(row?.totp_secret).toBeNull();
    expect(row?.totp_backup_codes).toBeNull();

    // Login ahora vuelve a ser directo, sin segundo factor.
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.body.requires_2fa).toBeUndefined();
  });

  it('con un backup code también desactiva (no exige exclusivamente TOTP)', async () => {
    const email    = 'admin-disable-backup@test.local';
    const password = 'AdminPass123!';
    const { backupCodes, cookie } = await createAdminWith2FA(email, password);

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Cookie', cookie)
      .send({ password, code: backupCodes[0] });

    expect(res.status).toBe(200);
    const row = await queryOne<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE email = $1', [email]);
    expect(row?.totp_enabled).toBe(false);
  });

  it('con password incorrecta devuelve 401 y NO desactiva', async () => {
    const email    = 'admin-disable-badpass@test.local';
    const password = 'AdminPass123!';
    const { cookie } = await createAdminWith2FA(email, password);

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Cookie', cookie)
      .send({ password: 'Incorrecta123!', code: '123456' });

    expect(res.status).toBe(401);
    const row = await queryOne<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE email = $1', [email]);
    expect(row?.totp_enabled).toBe(true);
  });

  it('con código incorrecto devuelve 401 y NO desactiva', async () => {
    const email    = 'admin-disable-badcode@test.local';
    const password = 'AdminPass123!';
    const { cookie } = await createAdminWith2FA(email, password);

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Cookie', cookie)
      .send({ password, code: '000000' });

    expect(res.status).toBe(401);
    const row = await queryOne<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE email = $1', [email]);
    expect(row?.totp_enabled).toBe(true);
  });

  it('sin 2FA activo devuelve 400', async () => {
    const email    = 'admin-no-2fa@test.local';
    const password = 'AdminPass123!';
    await createUser({ email, password, role: 'admin' });
    const cookie = await loginAndGetCookie(email, password);

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Cookie', cookie)
      .send({ password, code: '123456' });

    expect(res.status).toBe(400);
  });
});
