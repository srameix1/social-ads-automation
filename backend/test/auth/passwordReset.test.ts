import request from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockImplementation(async (args: { html?: string }) => {
        (global as unknown as { __lastResendHtml?: string }).__lastResendHtml = args.html;
        return { data: { id: 'test-email' }, error: null };
      }),
    },
  })),
}));

import app from '../../src/app';
import { query, queryOne } from '../../src/config/database';
import { truncateAllTables, closeTestPool } from '../setup/dbTestHelper';

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

async function registerUser(email: string, password: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(201);
  // Verification is out of scope for this flow; mark the account verified
  // directly so the password can be exercised end to end.
  await query('UPDATE users SET email_verified = TRUE WHERE email = $1', [email]);
}

describe('POST /api/auth/forgot-password', () => {
  it('responde igual para un correo inexistente (no enumera cuentas)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nadie@test.local' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('guarda solo el hash del token, nunca el token en texto plano', async () => {
    await registerUser('reset-hash@test.local', 'Original123!');
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset-hash@test.local' });
    expect(res.status).toBe(200);

    const html = (global as unknown as { __lastResendHtml?: string }).__lastResendHtml ?? '';
    const match = html.match(/reset-password\?token=([a-f0-9]{64})/);
    expect(match).not.toBeNull();
    const rawToken = match![1];

    const row = await queryOne<{ reset_token_hash: string }>(
      'SELECT reset_token_hash FROM users WHERE email = $1', ['reset-hash@test.local'],
    );
    expect(row).not.toBeNull();
    // Stored value is the SHA-256 of the emailed token, not the token itself.
    expect(row!.reset_token_hash).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
    expect(row!.reset_token_hash).not.toBe(rawToken);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('restablece la contraseña y el token ya no se puede reutilizar', async () => {
    const email = 'reset-ok@test.local';
    await registerUser(email, 'Original123!');
    await request(app).post('/api/auth/forgot-password').send({ email });

    // The raw token is not stored; recover it the way the test harness can:
    // re-issue is not possible, so instead drive the service through a
    // known token by writing its hash directly (same hash function as the
    // service) — this keeps the test independent of the email mock.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await query(
      `UPDATE users SET reset_token_hash = $1, reset_token_expires_at = NOW() + INTERVAL '1 hour' WHERE email = $2`,
      [hash, email],
    );

    const ok = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'NuevaClave123!' });
    expect(ok.status).toBe(200);

    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1', [email],
    );
    await expect(bcrypt.compare('NuevaClave123!', user!.password_hash)).resolves.toBe(true);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'OtraClave123!' });
    expect(reuse.status).toBe(400);
  });

  it('rechaza un token expirado y una contraseña corta', async () => {
    const email = 'reset-exp@test.local';
    await registerUser(email, 'Original123!');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await query(
      `UPDATE users SET reset_token_hash = $1, reset_token_expires_at = NOW() - INTERVAL '1 minute' WHERE email = $2`,
      [hash, email],
    );

    const expired = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'NuevaClave123!' });
    expect(expired.status).toBe(400);

    const short = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'cualquier-token', password: 'corta' });
    expect(short.status).toBe(400);
  });
});
