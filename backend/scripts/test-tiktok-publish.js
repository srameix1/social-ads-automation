// Standalone diagnostic script — calls the REAL publishToTikTok(...) from
// dist/services/tiktok.service.js against an already-generated video and
// already-stored TikTok credentials. No AI generation involved (no Grok/KIE
// calls, no credit spend) and no writes to posts/publications — read-only
// DB lookups + one real outbound call to TikTok's init endpoint.
//
// Run inside the production container (no tsc/ts-node needed — requires the
// already-compiled dist/ output, same as what npm start runs):
//   node scripts/test-tiktok-publish.js
//
// Not wired into any route/service/build step — same category as
// test-xfade.js / test-overlay.js (plain JS, no compile step, not part of
// tsc's "include": ["src/**/*"]).

const { queryOne }                = require('../dist/config/database');
const { getDecryptedCredentials } = require('../dist/modules/credentials/credentials.service');
const { publishToTikTok }         = require('../dist/services/tiktok.service');
const { env }                     = require('../dist/config/env');

// ── Edit these ──────────────────────────────────────────────────────────────
const TARGET_EMAIL = 'srameix+trial7@gmail.com';
const TEST_CAPTION = '[TEST] Diagnóstico interno — ignorar';
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[TIKTOK TEST] Buscando usuario:', TARGET_EMAIL);

  const user = await queryOne(
    'SELECT id FROM users WHERE email = $1',
    [TARGET_EMAIL],
  );
  if (!user) {
    console.error(`[TIKTOK TEST] FALLO: no existe un usuario con email ${TARGET_EMAIL}`);
    process.exit(1);
  }
  console.log('[TIKTOK TEST] userId:', user.id);

  // Reutiliza la variación de video "ready" más reciente de ESE usuario —
  // ya generada y servida en producción, sin disparar generación nueva.
  const variation = await queryOne(
    `SELECT vv.url
     FROM visual_variations vv
     JOIN posts p ON p.id = vv.post_id
     JOIN campaigns c ON c.id = p.campaign_id
     WHERE c.client_id = $1
       AND vv.type = 'video'
       AND vv.status = 'ready'
       AND vv.url IS NOT NULL
     ORDER BY vv.created_at DESC
     LIMIT 1`,
    [user.id],
  );
  if (!variation) {
    console.error('[TIKTOK TEST] FALLO: no hay ninguna visual_variation de tipo video con status ready para este usuario');
    process.exit(1);
  }

  // Mismo criterio que enqueuePublishJobs (publishPost.job.ts) para resolver
  // paths relativos a URL absoluta servida por el backend.
  const videoUrl = variation.url.startsWith('/') ? `${env.BACKEND_URL}${variation.url}` : variation.url;
  console.log('[TIKTOK TEST] video_url:', videoUrl);

  console.log('[TIKTOK TEST] Desencriptando credenciales de TikTok...');
  let credentials;
  try {
    credentials = await getDecryptedCredentials(user.id, 'tiktok');
  } catch (err) {
    console.error(`[TIKTOK TEST] FALLO: no se pudieron obtener credenciales de TikTok — ${err.message}`);
    process.exit(1);
  }
  console.log('[TIKTOK TEST] open_id:', credentials.open_id, '/ access_token presente:', !!credentials.access_token);

  console.log('[TIKTOK TEST] TIKTOK_APP_AUDITED (env):', process.env.TIKTOK_APP_AUDITED);
  console.log('[TIKTOK TEST] Llamando a publishToTikTok(...) — request real a TikTok...\n');

  try {
    const result = await publishToTikTok(credentials, videoUrl, TEST_CAPTION, 'video');
    console.log('\n[TIKTOK TEST] EXITO:', JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error('\n[TIKTOK TEST] FALLO — publishToTikTok lanzó:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[TIKTOK TEST] Error fatal:', err);
  process.exit(1);
});
