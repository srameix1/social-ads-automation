import fs from 'fs';
import path from 'path';
import os from 'os';
import { query } from '../../src/config/database';
import { truncateAllTables, closeTestPool } from '../setup/dbTestHelper';
import { cleanupOldFiles } from '../../src/jobs/cleanupVideos.job';

async function createUser(email: string): Promise<{ id: string }> {
  const [user] = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role, is_active, email_verified)
     VALUES ($1, 'x', 'client', TRUE, TRUE) RETURNING id`,
    [email],
  );
  return user;
}

async function createCampaign(clientId: string): Promise<{ id: string }> {
  const [campaign] = await query<{ id: string }>(
    `INSERT INTO campaigns (client_id, title) VALUES ($1, 'Test') RETURNING id`,
    [clientId],
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

async function createVariation(postId: string, url: string): Promise<{ id: string }> {
  const [variation] = await query<{ id: string }>(
    `INSERT INTO visual_variations (post_id, position, url, status, type)
     VALUES ($1, 1, $2, 'ready', 'image') RETURNING id`,
    [postId, url],
  );
  return variation;
}

function touch(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'fake-image-data');
}

// maxAgeMs artificialmente bajo en los tests (en vez de 7 días reales) — la
// antigüedad se fuerza igual, moviendo mtime al pasado con utimesSync.
function setMtime(filePath: string, ageMs: number): void {
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(filePath, t, t);
}

const EIGHT_DAYS_MS   = 8 * 24 * 60 * 60 * 1000;
const TINY_MAX_AGE_MS = 100; // umbral artificial — cualquier archivo de 8 días lo supera

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

describe('cleanupOldFiles — expira visual_variations al borrar su archivo (Opción 2)', () => {
  it('borra el archivo viejo del disco y marca expired_at en la fila que lo referencia', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-expire-test-'));
    try {
      const user     = await createUser('cleanup-expire@test.local');
      const campaign = await createCampaign(user.id);
      const post     = await createPost(campaign.id);

      const relativeUrl = `/uploads/variations/${post.id}/variation_1.jpg`;
      const filePath     = path.join(root, 'variations', post.id, 'variation_1.jpg');
      touch(filePath);
      setMtime(filePath, EIGHT_DAYS_MS);

      const variation = await createVariation(post.id, relativeUrl);

      const result = await cleanupOldFiles(root, TINY_MAX_AGE_MS);

      expect(fs.existsSync(filePath)).toBe(false);
      expect(result.deletedFiles).toBe(1);
      expect(result.expiredRows).toBe(1);

      const [row] = await query<{ expired_at: string | null; url: string | null }>(
        'SELECT expired_at, url FROM visual_variations WHERE id = $1',
        [variation.id],
      );
      expect(row.expired_at).not.toBeNull();
      // url no se toca — solo se agrega el marcador (spec de la migración 030)
      expect(row.url).toBe(relativeUrl);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('borra un temporal de staging (_tmp_*) sin fila asociada sin fallar ni marcar nada', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-expire-tmp-test-'));
    try {
      const tmpPath = path.join(root, 'variations', 'some-post-id', '_tmp_reel_src1.jpg');
      touch(tmpPath);
      setMtime(tmpPath, EIGHT_DAYS_MS);

      const result = await cleanupOldFiles(root, TINY_MAX_AGE_MS);

      expect(fs.existsSync(tmpPath)).toBe(false);
      expect(result.deletedFiles).toBe(1);
      expect(result.expiredRows).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('no toca la fila de una variación cuyo archivo sigue vigente (no borrado)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-expire-fresh-test-'));
    try {
      const user     = await createUser('cleanup-expire-fresh@test.local');
      const campaign = await createCampaign(user.id);
      const post     = await createPost(campaign.id);

      const relativeUrl = `/uploads/variations/${post.id}/variation_1.jpg`;
      const filePath     = path.join(root, 'variations', post.id, 'variation_1.jpg');
      touch(filePath); // mtime = ahora, dentro del umbral

      const variation = await createVariation(post.id, relativeUrl);

      const result = await cleanupOldFiles(root, EIGHT_DAYS_MS); // umbral generoso — nada expira

      expect(fs.existsSync(filePath)).toBe(true);
      expect(result.deletedFiles).toBe(0);
      expect(result.expiredRows).toBe(0);

      const [row] = await query<{ expired_at: string | null }>(
        'SELECT expired_at FROM visual_variations WHERE id = $1',
        [variation.id],
      );
      expect(row.expired_at).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
