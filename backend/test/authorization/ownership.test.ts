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

async function createCampaign(clientId: string, title: string): Promise<{ id: string }> {
  const [campaign] = await query<{ id: string }>(
    `INSERT INTO campaigns (client_id, title) VALUES ($1, $2) RETURNING id`,
    [clientId, title],
  );
  return campaign;
}

async function createPost(campaignId: string): Promise<{ id: string }> {
  const [post] = await query<{ id: string }>(
    `INSERT INTO posts (campaign_id) VALUES ($1) RETURNING id`,
    [campaignId],
  );
  return post;
}

// @types/superagent tipa Response.headers['set-cookie'] como `string`, pero
// Node siempre lo entrega como string[] en runtime — normalizamos acá
// (mismo helper que test/auth/login.test.ts).
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

describe('Aislamiento entre clientes (ownership cross-tenant)', () => {
  it('GET /api/campaigns/:id — Client A no puede leer una campaña de Client B (404, nunca los datos de B)', async () => {
    const clientA = await createUser({ email: 'client-a@test.local', password: 'ClientA123!' });
    const clientB = await createUser({ email: 'client-b@test.local', password: 'ClientB123!' });

    const campaignA = await createCampaign(clientA.id, 'Campaña de A');
    const campaignB = await createCampaign(clientB.id, 'Campaña de B');

    const cookieA = await loginAndGetCookie('client-a@test.local', 'ClientA123!');

    // Control: A sí puede leer su propia campaña — así el 404 de abajo prueba
    // aislamiento real y no un endpoint roto que siempre devuelve 404.
    const ownRes = await request(app)
      .get(`/api/campaigns/${campaignA.id}`)
      .set('Cookie', cookieA);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.campaign.id).toBe(campaignA.id);

    // El ataque: sesión de A, ID real de B.
    const crossRes = await request(app)
      .get(`/api/campaigns/${campaignB.id}`)
      .set('Cookie', cookieA);

    expect(crossRes.status).toBe(404);
    expect(crossRes.body.campaign).toBeUndefined();
    expect(JSON.stringify(crossRes.body)).not.toContain('Campaña de B');
  });

  it('GET /api/posts/:postId — Client A no puede leer un post de una campaña de Client B (404)', async () => {
    const clientA = await createUser({ email: 'client-a2@test.local', password: 'ClientA123!' });
    const clientB = await createUser({ email: 'client-b2@test.local', password: 'ClientB123!' });

    const campaignB = await createCampaign(clientB.id, 'Campaña de B');
    const postB      = await createPost(campaignB.id);

    const cookieA = await loginAndGetCookie('client-a2@test.local', 'ClientA123!');

    const res = await request(app)
      .get(`/api/posts/${postB.id}`)
      .set('Cookie', cookieA);

    expect(res.status).toBe(404);
    expect(res.body.post).toBeUndefined();
  });

  it('GET /api/admin/clients — un cliente (no admin) recibe 403, nunca 200', async () => {
    await createUser({ email: 'not-admin@test.local', password: 'ClientA123!', role: 'client' });
    const cookieClient = await loginAndGetCookie('not-admin@test.local', 'ClientA123!');

    const res = await request(app)
      .get('/api/admin/clients')
      .set('Cookie', cookieClient);

    expect(res.status).toBe(403);
    expect(res.body.clients).toBeUndefined();
  });
});
