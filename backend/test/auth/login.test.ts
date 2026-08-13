import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { query } from '../../src/config/database';
import { truncateAllTables, closeTestPool } from '../setup/dbTestHelper';

interface SeededUser {
  id:    string;
  email: string;
}

async function createUser(opts: {
  email:          string;
  password:       string;
  emailVerified?: boolean;
  isActive?:      boolean;
  role?:          'client' | 'admin';
}): Promise<SeededUser> {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const [user] = await query<SeededUser>(
    `INSERT INTO users (email, password_hash, role, is_active, email_verified)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email`,
    [
      opts.email,
      passwordHash,
      opts.role ?? 'client',
      opts.isActive ?? true,
      opts.emailVerified ?? true,
    ],
  );
  return user;
}

// @types/superagent tipa Response.headers['set-cookie'] como `string`, pero
// Node siempre lo entrega como string[] en runtime — normalizamos acá.
function findCookie(setCookieHeader: string | string[] | undefined, name: string): string | undefined {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

const GENERIC_LOGIN_ERROR = 'Credenciales incorrectas';

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('POST /api/auth/login', () => {
  it('con credenciales correctas devuelve 200, { user, token }, y auth_token como cookie HttpOnly', async () => {
    await createUser({ email: 'login-ok@test.local', password: 'Test1234!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login-ok@test.local', password: 'Test1234!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user).toMatchObject({
      email:          'login-ok@test.local',
      role:           'client',
      is_active:      true,
      email_verified: true,
    });
    expect(res.body.user.password_hash).toBeUndefined();

    // Chequeo del header crudo, no sólo el body: esto es lo que falló y un
    // test de solo status code no lo hubiera atrapado.
    const authCookie = findCookie(res.headers['set-cookie'], 'auth_token');
    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);
  });

  it('con email inexistente devuelve 401 y mensaje genérico', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@test.local', password: 'CualquierCosa1!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe(GENERIC_LOGIN_ERROR);
  });

  it('con password incorrecta devuelve 401 y el mismo mensaje genérico', async () => {
    await createUser({ email: 'wrongpass@test.local', password: 'Correcta123!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpass@test.local', password: 'Incorrecta123!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe(GENERIC_LOGIN_ERROR);
  });

  it('con email_verified=false devuelve 403 con code EMAIL_UNVERIFIED', async () => {
    await createUser({
      email:         'unverified@test.local',
      password:      'Test1234!',
      emailVerified: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unverified@test.local', password: 'Test1234!' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_UNVERIFIED');
  });

  it('con is_active=false devuelve 403', async () => {
    await createUser({
      email:    'deactivated@test.local',
      password: 'Test1234!',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deactivated@test.local', password: 'Test1234!' });

    expect(res.status).toBe(403);
  });

  it('bloquea el 6to intento tras 5 fallos seguidos, incluso con password correcta', async () => {
    await createUser({ email: 'ratelimit@test.local', password: 'Correcta123!' });

    for (let i = 0; i < 5; i++) {
      const failed = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ratelimit@test.local', password: 'Incorrecta123!' });
      expect(failed.status).toBe(401);
    }

    const sixthAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit@test.local', password: 'Correcta123!' });

    expect(sixthAttempt.status).toBe(401);
    expect(sixthAttempt.body.error).toBe(GENERIC_LOGIN_ERROR);
  });
});

describe('GET /api/auth/me', () => {
  it('con la cookie de un login exitoso devuelve 200 con los datos del usuario', async () => {
    await createUser({ email: 'me-flow@test.local', password: 'Test1234!' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'me-flow@test.local', password: 'Test1234!' });

    const authCookie = findCookie(loginRes.headers['set-cookie'], 'auth_token');
    expect(authCookie).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie!.split(';')[0]);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user).toMatchObject({
      email:        'me-flow@test.local',
      role:         'client',
      totp_enabled: false, // default para una cuenta sin 2FA
    });
  });
});
