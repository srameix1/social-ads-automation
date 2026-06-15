/**
 * Test: calls confirmPost service directly with overlay_copy=true
 * and verifies the overlaid file is created on disk and the DB URL is updated.
 *
 * Run: npx ts-node --transpile-only test-confirm-overlay.ts
 */

import path from 'path';
import fs   from 'fs';

// Load env FIRST before any service imports that read env on module load
import './src/config/env';

import { query, queryOne, pool } from './src/config/database';
import { confirmPost }            from './src/modules/posts/posts.service';
import { env }                    from './src/config/env';

interface PostRow {
  post_id:        string;
  client_id:      string;
  workflow_status: string;
  variation_id:   string;
  variation_url:  string;
  variation_type: string;
}

async function main() {
  console.log('=== test-confirm-overlay ===\n');

  // ── 1. Find a usable post ──────────────────────────────────────────────────
  console.log('1. Buscando post con video en DB...');

  const row = await queryOne<PostRow>(`
    SELECT
      p.id               AS post_id,
      c.client_id        AS client_id,
      p.workflow_status,
      vv.id              AS variation_id,
      vv.url             AS variation_url,
      vv.type            AS variation_type
    FROM posts p
    JOIN campaigns c    ON c.id = p.campaign_id
    JOIN visual_variations vv ON vv.id = p.visual_variation_id
    WHERE vv.type = 'video'
      AND vv.url LIKE '%.mp4'
      AND p.workflow_status IN ('visual_selected', 'confirmed', 'generating_video')
    ORDER BY p.created_at DESC
    LIMIT 1
  `);

  if (!row) {
    console.error('FAILED: No se encontró ningún post con video .mp4 en DB.');
    console.error('  → Genera un video primero usando la app.');
    await pool.end();
    process.exit(1);
  }

  console.log(`  post_id        : ${row.post_id}`);
  console.log(`  client_id      : ${row.client_id}`);
  console.log(`  workflow_status: ${row.workflow_status}`);
  console.log(`  variation_id   : ${row.variation_id}`);
  console.log(`  variation_url  : ${row.variation_url}`);
  console.log(`  variation_type : ${row.variation_type}`);

  // ── 2. Verify the MP4 exists on disk ──────────────────────────────────────
  console.log('\n2. Verificando que el video existe en disco...');
  const match = row.variation_url.match(/\/uploads\/(.+)$/);
  if (!match) {
    console.error(`FAILED: No se pudo parsear la URL: ${row.variation_url}`);
    await pool.end();
    process.exit(1);
  }

  const uploadsDir = path.resolve(env.UPLOADS_DIR);
  const videoPath  = path.join(uploadsDir, match[1]);
  if (!fs.existsSync(videoPath)) {
    console.error(`FAILED: El video no existe en disco: ${videoPath}`);
    await pool.end();
    process.exit(1);
  }
  console.log(`  ✓ Existe: ${videoPath} (${(fs.statSync(videoPath).size / 1024).toFixed(1)} KB)`);

  // ── 3. Call confirmPost directly ──────────────────────────────────────────
  console.log('\n3. Llamando confirmPost(overlay_copy=true, overlay_logo=false)...');
  console.log('   (Esperar logs de [confirmPost], [applyOverlaysToPost], [applyVideoOverlays])\n');

  let result: Awaited<ReturnType<typeof confirmPost>>;
  try {
    result = await confirmPost(
      row.post_id,
      row.client_id,
      false,  // overlayLogo
      true,   // overlayCopy
    );
  } catch (err) {
    console.error(`\nFAILED: confirmPost lanzó una excepción:`);
    console.error((err as Error).stack ?? (err as Error).message);
    await pool.end();
    process.exit(1);
  }

  console.log('\n4. confirmPost returned:');
  console.log('   post.workflow_status :', result.post.workflow_status);
  console.log('   variationUrl         :', result.variationUrl);

  // ── 4. Verify variationUrl is returned ────────────────────────────────────
  if (!result.variationUrl) {
    console.error('\nFAILED: variationUrl es null — applyOverlaysToPost no se ejecutó o retornó null.');
    console.error('  → Revisar logs arriba por [confirmPost] Overlay failed o condición variation_type != video');
    await pool.end();
    process.exit(1);
  }

  // ── 5. Verify the overlaid file exists on disk ────────────────────────────
  console.log('\n5. Verificando archivo _overlaid.mp4 en disco...');
  const overlaidMatch = result.variationUrl.match(/\/uploads\/(.+)$/);
  if (!overlaidMatch) {
    console.error(`FAILED: URL overlaid mal formada: ${result.variationUrl}`);
    await pool.end();
    process.exit(1);
  }

  const overlaidPath = path.join(uploadsDir, overlaidMatch[1]);
  if (!fs.existsSync(overlaidPath)) {
    console.error(`FAILED: Archivo overlaid no existe en disco: ${overlaidPath}`);
    await pool.end();
    process.exit(1);
  }

  const overlaidSize = fs.statSync(overlaidPath).size;
  if (overlaidSize === 0) {
    console.error(`FAILED: Archivo overlaid existe pero tiene 0 bytes: ${overlaidPath}`);
    await pool.end();
    process.exit(1);
  }

  console.log(`  ✓ Existe: ${overlaidPath} (${(overlaidSize / 1024).toFixed(1)} KB)`);

  // ── 6. Verify the DB was updated ──────────────────────────────────────────
  console.log('\n6. Verificando que la DB se actualizó...');
  const dbRow = await queryOne<{ url: string }>(
    'SELECT url FROM visual_variations WHERE id = $1',
    [row.variation_id],
  );

  if (!dbRow) {
    console.error(`FAILED: No se encontró la variación ${row.variation_id} en DB.`);
    await pool.end();
    process.exit(1);
  }

  if (dbRow.url !== result.variationUrl) {
    console.error(`FAILED: URL en DB no coincide con variationUrl devuelto.`);
    console.error(`  DB url     : ${dbRow.url}`);
    console.error(`  variationUrl: ${result.variationUrl}`);
    await pool.end();
    process.exit(1);
  }

  console.log(`  ✓ DB.url actualizado a: ${dbRow.url}`);

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════');
  console.log('SUCCESS');
  console.log('══════════════════════════════════');
  console.log(`  post_id      : ${row.post_id}`);
  console.log(`  original url : ${row.variation_url}`);
  console.log(`  overlaid url : ${result.variationUrl}`);
  console.log(`  overlaid size: ${(overlaidSize / 1024).toFixed(1)} KB`);
  console.log(`  DB updated   : ✓`);

  await pool.end();
}

main().catch(async err => {
  console.error('\nFAILED (unhandled):', (err as Error).stack ?? err);
  await pool.end().catch(() => {});
  process.exit(1);
});
