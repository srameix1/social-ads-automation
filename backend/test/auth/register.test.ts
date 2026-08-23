import request from 'supertest';
import bcrypt from 'bcrypt';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'test-email' }, error: null }),
    },
  })),
}));

import app from '../../src/app';
import { queryOne } from '../../src/config/database';
import { truncateAllTables, closeTestPool } from '../setup/dbTestHelper';

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('POST /api/auth/register', () => {
  it('guarda un hash bcrypt verificable y nunca la contraseña en texto plano', async () => {
    const email = 'register-bcrypt@test.local';
    const password = 'Registro123!';

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password });

    expect(res.status).toBe(201);

    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [email],
    );

    expect(user).not.toBeNull();
    expect(user!.password_hash).not.toBe(password);
    await expect(bcrypt.compare(password, user!.password_hash)).resolves.toBe(true);
  });
});
