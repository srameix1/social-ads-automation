// Standalone diagnostic script — tests Alibaba Happy Horse 1.1 (Replicate)
// in "reference-to-video" mode. No INSERT/UPDATE, does not touch
// posts/publications.
//
// Two modes:
//
//   1. Original (no args) — 4 REAL images already generated for an existing
//      post, read from visual_variations (DB, read-only). No Gemini/Grok
//      credit spend, no new AI generation on our side. Same as Sesión 22.
//        node scripts/test-happyhorse.js
//
//   2. Corrida mode — 4 images from a Gemini test batch already sitting in
//      /app/test-output/gemini-prompts/ (generated via test-gemini-image),
//      no DB/post_id involved. Images are copied into UPLOADS_DIR first
//      (test-output/ is not served statically — only /uploads is, see
//      app.ts:61-64) so toAbsoluteUrl() produces URLs Replicate can fetch.
//        node scripts/test-happyhorse.js corrida-A "prompt de progresión..."
//        node scripts/test-happyhorse.js corrida-B "prompt de progresión..."
//      The prompt argument is optional in corrida mode too — omitting it
//      falls back to the same default PROMPT used in the original mode.
//
// Run inside the production container (requires the already-compiled dist/
// output, same as what npm start runs):
//   node scripts/test-happyhorse.js [corrida] [prompt]
//
// Not wired into any route/service/build step — same category as
// test-tiktok-publish.js / test-tiktok-status.js / test-overlay.js.

const fs         = require('fs');
const path       = require('path');
const { query }  = require('../dist/config/database');
const { env }    = require('../dist/config/env');

// ── Edit these ──────────────────────────────────────────────────────────────
const POST_ID = '1181db12-9f0f-474a-89c8-e56a2ab96ce2';

const PROMPT =
  'Progressive narrative sequence showing a car detailing process: ' +
  '[Image 1] shows the initial state, [Image 2] shows active work in ' +
  'progress on a different area of the vehicle, [Image 3] shows further ' +
  'progress, [Image 4] reveals the final polished result. Each image ' +
  'represents a distinct moment in the process — avoid repeating the same ' +
  'action or camera angle across images. Keep the same person and outfit ' +
  'consistent throughout.' +
  ' No text, no signs, no captions, no subtitles, no watermarks, no UI elements, ' +
  'no logos, no brand names or business names rendered as visible text, no storefront signage with text.';

const RESOLUTION       = '720p';
const DURATION         = 15;
const ASPECT_RATIO     = '9:16';
const OUTPUT_PATH      = '/app/uploads/test-happyhorse-output-3.mp4';
const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS       = 5 * 60 * 1000;

// Corrida mode: filename sets already generated via test-gemini-image
const GEMINI_PROMPTS_DIR = '/app/test-output/gemini-prompts';
const CORRIDAS = {
  'corrida-A': ['corrida-A-01.jpg', 'corrida-A-02.jpg', 'corrida-A-03.jpg', 'corrida-A-04.jpg'],
  'corrida-B': ['corrida-B-01.jpg', 'corrida-B-02.jpg', 'corrida-B-03.jpg', 'corrida-B-04-v2.jpg'],
};
// ────────────────────────────────────────────────────────────────────────────

const REPLICATE_MODEL = 'alibaba/happyhorse-1.1';
const REPLICATE_API   = `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`;

function replicateHeaders() {
  return {
    Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function toAbsoluteUrl(relativeOrAbsolute) {
  return relativeOrAbsolute.startsWith('/')
    ? `${env.BACKEND_URL}${relativeOrAbsolute}`
    : relativeOrAbsolute;
}

// ── Modo original: lee las 4 imágenes reales desde visual_variations ───────

async function fetchReferenceImages(postId) {
  return query(
    `SELECT position, url
     FROM visual_variations
     WHERE post_id = $1 AND type = 'image'
     ORDER BY position`,
    [postId],
  );
}

async function resolveImagesFromDb() {
  console.log('[HAPPYHORSE TEST] post_id:', POST_ID);
  console.log('[HAPPYHORSE TEST] Buscando las 4 imágenes reales (visual_variations)...');

  const variations = await fetchReferenceImages(POST_ID);
  if (!variations || variations.length === 0) {
    throw new Error(`No hay visual_variations de tipo 'image' para post_id ${POST_ID}`);
  }
  if (variations.some(v => !v.url)) {
    throw new Error('Alguna variación no tiene url asignada todavía');
  }

  return {
    images:     variations.map(v => toAbsoluteUrl(v.url)),
    outputPath: OUTPUT_PATH,
  };
}

// ── Modo corrida: imágenes de test-output/gemini-prompts, sin DB/post_id ───
//
// test-output/ no se sirve públicamente (solo /uploads lo está — ver
// app.ts:61-64), así que copiamos las 4 imágenes a
// UPLOADS_DIR/test-happyhorse-refs/<corrida>/ antes de armar las URLs.

function publishCorridaImages(corrida) {
  const filenames = CORRIDAS[corrida];
  if (!filenames) {
    throw new Error(`Corrida desconocida: '${corrida}'. Válidas: ${Object.keys(CORRIDAS).join(', ')}`);
  }

  const destDir = path.join(path.resolve(env.UPLOADS_DIR), 'test-happyhorse-refs', corrida);
  fs.mkdirSync(destDir, { recursive: true });

  return filenames.map((filename) => {
    const src = path.join(GEMINI_PROMPTS_DIR, filename);
    if (!fs.existsSync(src)) {
      throw new Error(`No existe la imagen de referencia: ${src} (¿se generó con test-gemini-image?)`);
    }
    const dest = path.join(destDir, filename);
    fs.copyFileSync(src, dest);
    return `/uploads/test-happyhorse-refs/${corrida}/${filename}`;
  });
}

function resolveImagesFromCorrida(corrida) {
  console.log('[HAPPYHORSE TEST] Modo corrida:', corrida, '(sin DB, sin post_id)');
  const relativeUrls = publishCorridaImages(corrida);

  return {
    images:     relativeUrls.map(toAbsoluteUrl),
    outputPath: `/app/uploads/test-happyhorse-${corrida}-${Date.now()}.mp4`,
  };
}

// ── Replicate: crear predicción, pollear, descargar ─────────────────────────

async function createPrediction(images, prompt) {
  const res = await fetch(REPLICATE_API, {
    method:  'POST',
    headers: replicateHeaders(),
    body: JSON.stringify({
      input: {
        prompt,
        images,
        resolution:   RESOLUTION,
        duration:     DURATION,
        aspect_ratio: ASPECT_RATIO,
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Replicate rechazó la predicción (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return body; // { id, status, urls: { get, cancel }, ... }
}

async function pollPrediction(getUrl) {
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      throw new Error(`Timeout de ${TIMEOUT_MS / 1000}s esperando a que la predicción termine`);
    }

    const res  = await fetch(getUrl, { headers: replicateHeaders() });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`Fallo al pollear la predicción (HTTP ${res.status}): ${JSON.stringify(body)}`);
    }

    console.log(`[HAPPYHORSE TEST] status: ${body.status}`);

    if (body.status === 'succeeded') return body;
    if (body.status === 'failed' || body.status === 'canceled') {
      throw new Error(`Predicción terminó en estado '${body.status}': ${JSON.stringify(body.error ?? body)}`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

function extractVideoUrl(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  throw new Error(`No se pudo extraer una URL de video del campo "output": ${JSON.stringify(output)}`);
}

async function downloadVideo(videoUrl, outputPath) {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Fallo al descargar el video final (HTTP ${res.status}) desde ${videoUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  if (!env.REPLICATE_API_TOKEN) {
    console.error('[HAPPYHORSE TEST] FALLO: REPLICATE_API_TOKEN no está seteado');
    process.exit(1);
  }

  const [corridaArg, promptArg] = process.argv.slice(2);
  const prompt = promptArg || PROMPT;

  let resolved;
  try {
    resolved = corridaArg ? resolveImagesFromCorrida(corridaArg) : await resolveImagesFromDb();
  } catch (err) {
    console.error('[HAPPYHORSE TEST] FALLO:', err.message);
    process.exit(1);
    return;
  }

  const { images, outputPath } = resolved;

  images.forEach((url, i) => console.log(`[HAPPYHORSE TEST]   [Image ${i + 1}]: ${url}`));

  console.log('[HAPPYHORSE TEST] Parámetros:', { resolution: RESOLUTION, duration: DURATION, aspect_ratio: ASPECT_RATIO });
  console.log('[HAPPYHORSE TEST] Prompt:', prompt.slice(0, 120) + (prompt.length > 120 ? '…' : ''));
  console.log('[HAPPYHORSE TEST] Creando predicción en Replicate...');

  try {
    const created = await createPrediction(images, prompt);
    console.log('[HAPPYHORSE TEST] prediction id:', created.id, '/ status inicial:', created.status);

    const getUrl = created.urls?.get;
    if (!getUrl) {
      throw new Error(`La respuesta de Replicate no trae urls.get: ${JSON.stringify(created)}`);
    }

    console.log('[HAPPYHORSE TEST] Polleando cada', POLL_INTERVAL_MS / 1000, 's (timeout', TIMEOUT_MS / 1000, 's)...');
    const finished = await pollPrediction(getUrl);

    const videoUrl = extractVideoUrl(finished.output);
    console.log('[HAPPYHORSE TEST] Video generado:', videoUrl);
    console.log('[HAPPYHORSE TEST] Descargando a', outputPath, '...');

    await downloadVideo(videoUrl, outputPath);

    console.log(`[HAPPYHORSE TEST] EXITO: video guardado en ${outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error('\n[HAPPYHORSE TEST] FALLO:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[HAPPYHORSE TEST] Error fatal:', err);
  process.exit(1);
});
