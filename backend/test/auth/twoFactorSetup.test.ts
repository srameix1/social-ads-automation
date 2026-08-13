import request from 'supertest';
import bcrypt from 'bcrypt';
import { generate as generateTotpCode } from 'otplib';
import app from '../../src/app';
import { query, queryOne } from '../../src/config/database';
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

// Mismo helper que test/auth/login.test.ts y test/authorization/ownership.test.ts —
// @types/superagent tipa Response.headers['set-cookie'] como `string`, Node
// siempre lo entrega como string[] en runtime.
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

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('POST /api/auth/2fa/setup', () => {
  it('un admin logueado recibe { secret, otpauthUrl }', async () => {
    await createUser({ email: 'admin-setup@test.local', password: 'AdminPass123!', role: 'admin' });
    const cookie = await loginAndGetCookie('admin-setup@test.local', 'AdminPass123!');

    const res = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.secret).toBe('string');
    expect(res.body.secret.length).toBeGreaterThan(0);
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(res.body.otpauthUrl).toContain(res.body.secret);

    const row = await queryOne<{ totp_secret: string; totp_enabled: boolean }>(
      'SELECT totp_secret, totp_enabled FROM users WHERE email = $1',
      ['admin-setup@test.local'],
    );
    // totp_secret se guarda cifrado (AES-256-GCM) — nunca debe coincidir con
    // el texto plano que devolvió la respuesta. El round-trip cifrado→
    // descifrado real se prueba de punta a punta en el test de
    // verify-setup, que activa 2FA con un código generado a partir de ese
    // mismo secreto en texto plano.
    expect(row?.totp_secret).toBeDefined();
    expect(row?.totp_secret).not.toBe(res.body.secret);
    expect(row?.totp_enabled).toBe(false); // todavía no activado
  });

  it('un cliente (no admin) recibe 403, nunca el secreto', async () => {
    await createUser({ email: 'client-setup@test.local', password: 'ClientPass123!', role: 'client' });
    const cookie = await loginAndGetCookie('client-setup@test.local', 'ClientPass123!');

    const res = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.secret).toBeUndefined();
  });

  it('sin sesión devuelve 401', async () => {
    const res = await request(app).post('/api/auth/2fa/setup');
    expect(res.status).toBe(401);
  });

  it('si 2FA ya está activo, rechaza con 409 en vez de rotar el secreto en silencio', async () => {
    const admin = await createUser({ email: 'admin-already@test.local', password: 'AdminPass123!', role: 'admin' });
    await query('UPDATE users SET totp_enabled = TRUE, totp_secret = $1 WHERE id = $2', ['SOMEEXISTINGSECRET', admin.id]);
    const cookie = await loginAndGetCookie('admin-already@test.local', 'AdminPass123!');

    const res = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);

    expect(res.status).toBe(409);
    const row = await queryOne<{ totp_secret: string }>('SELECT totp_secret FROM users WHERE id = $1', [admin.id]);
    expect(row?.totp_secret).toBe('SOMEEXISTINGSECRET'); // no lo tocó
  });
});

describe('POST /api/auth/2fa/verify-setup', () => {
  async function setupAndGetSecret(email: string, cookie: string): Promise<string> {
    const res = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);
    return res.body.secret as string;
  }

  it('con el código TOTP correcto activa 2FA y devuelve 8 códigos de respaldo en texto plano, una sola vez', async () => {
    await createUser({ email: 'admin-verify@test.local', password: 'AdminPass123!', role: 'admin' });
    const cookie = await loginAndGetCookie('admin-verify@test.local', 'AdminPass123!');
    const secret = await setupAndGetSecret('admin-verify@test.local', cookie);
    const code = await generateTotpCode({ secret });

    const res = await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', cookie)
      .send({ code });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes).toHaveLength(8);
    expect(new Set(res.body.backupCodes).size).toBe(8); // todos distintos

    const row = await queryOne<{ totp_enabled: boolean; totp_backup_codes: string[] }>(
      'SELECT totp_enabled, totp_backup_codes FROM users WHERE email = $1',
      ['admin-verify@test.local'],
    );
    expect(row?.totp_enabled).toBe(true);
    expect(row?.totp_backup_codes).toHaveLength(8);

    // Los hashes guardados NUNCA deben ser el texto plano devuelto, y sí
    // deben validar contra bcrypt — mismo mecanismo que password_hash.
    for (let i = 0; i < 8; i++) {
      expect(row!.totp_backup_codes[i]).not.toBe(res.body.backupCodes[i]);
      const matches = await Promise.all(
        (res.body.backupCodes as string[]).map((plain) => bcrypt.compare(plain, row!.totp_backup_codes[i])),
      );
      expect(matches.filter(Boolean)).toHaveLength(1); // matchea exactamente uno
    }
  });

  it('con un código incorrecto devuelve 401 y NO activa 2FA', async () => {
    await createUser({ email: 'admin-badcode@test.local', password: 'AdminPass123!', role: 'admin' });
    const cookie = await loginAndGetCookie('admin-badcode@test.local', 'AdminPass123!');
    await setupAndGetSecret('admin-badcode@test.local', cookie);

    const res = await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', cookie)
      .send({ code: '000000' });

    expect(res.status).toBe(401);
    const row = await queryOne<{ totp_enabled: boolean }>(
      'SELECT totp_enabled FROM users WHERE email = $1',
      ['admin-badcode@test.local'],
    );
    expect(row?.totp_enabled).toBe(false);
  });

  it('sin haber llamado a /setup antes, devuelve 400', async () => {
    await createUser({ email: 'admin-nosetup@test.local', password: 'AdminPass123!', role: 'admin' });
    const cookie = await loginAndGetCookie('admin-nosetup@test.local', 'AdminPass123!');

    const res = await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', cookie)
      .send({ code: '123456' });

    expect(res.status).toBe(400);
  });

  it('un cliente (no admin) recibe 403', async () => {
    await createUser({ email: 'client-verify@test.local', password: 'ClientPass123!', role: 'client' });
    const cookie = await loginAndGetCookie('client-verify@test.local', 'ClientPass123!');

    const res = await request(app)
      .post('/api/auth/2fa/verify-setup')
      .set('Cookie', cookie)
      .send({ code: '123456' });

    expect(res.status).toBe(403);
  });
});
