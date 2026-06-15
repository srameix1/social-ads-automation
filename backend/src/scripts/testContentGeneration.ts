/**
 * Test script — Content Generation para "Bella Vita" salon de belleza
 *
 * Genera los 5 archivos de salida en backend/test-output/:
 *   basic_feed.jpg         — 1080x1080
 *   basic_story.jpg        — 1080x1920
 *   professional_feed.mp4  — 1080x1080 Ken Burns 15s
 *   professional_story.mp4 — 1080x1920 Ken Burns 20s
 *   premium_reel.mp4       — 1080x1920 4 clips concatenados 32s
 *
 * Ejecución:
 *   npx ts-node --transpile-only src/scripts/testContentGeneration.ts
 */

// Must be first: set placeholder env vars so env.ts doesn't throw on import
// (contentGeneration.service uses process.env directly, but other transitives might not)
if (!process.env.JWT_SECRET)     process.env.JWT_SECRET     = 'standalone-test-script-placeholder';
if (!process.env.ENCRYPTION_KEY) process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';

import path from 'path';
import fs   from 'fs';

// Load real .env (overrides placeholders with real GEMINI_API_KEY if available)
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

import {
  generateBasicImages,
  generateProfessionalVideos,
  generatePremiumReel,
  type ContentInput,
} from '../services/contentGeneration.service';

// ── "Bella Vita" test data ─────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, '../../test-output');

// SVG placeholder logo — "BV" monogram golden badge
const LOGO_SVG = `<svg width="180" height="60" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="60" rx="6" fill="#C9A96E"/>
  <rect x="2" y="2" width="176" height="56" rx="5" fill="none" stroke="#8B6914" stroke-width="1.5"/>
  <text x="34" y="42" font-family="Arial" font-size="36" font-weight="bold" fill="#1A1A1A">BV</text>
  <text x="70" y="25" font-family="Arial" font-size="11" letter-spacing="3" fill="#1A1A1A" opacity="0.8">BELLA</text>
  <text x="70" y="42" font-family="Arial" font-size="11" letter-spacing="3" fill="#1A1A1A" opacity="0.8">VITA</text>
</svg>`;

const input: ContentInput = {
  businessName:  'Bella Vita',
  description:   'Salón de belleza de lujo especializado en coloración, cortes y tratamientos capilares premium',
  visualConcept: 'Ambiente cálido y elegante de salón de belleza, tonos dorados, espejo con iluminación Hollywood, productos de lujo en primer plano, atmósfera sofisticada y femenina',
  copyText:      'Transforma tu look este verano. Reserva tu cita hoy.',
  primaryColor:  '#C9A96E',
  secondaryColor: '#1A1A1A',
  logoBuffer:    Buffer.from(LOGO_SVG),
  outputDir:     OUTPUT_DIR,
  campaignId:    'test-bella-vita',
};

// ── Run ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  SANADDS Content Generation — Test "Bella Vita"');
  console.log('══════════════════════════════════════════════\n');
  console.log(`Output dir: ${OUTPUT_DIR}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const geminiAvailable = !!process.env.GEMINI_API_KEY;
  if (!geminiAvailable) {
    console.log('⚠  GEMINI_API_KEY no configurada — se usarán fondos sintéticos SVG\n');
  } else {
    console.log('✓  GEMINI_API_KEY detectada — fondos generados con IA\n');
  }

  const timings: Record<string, number> = {};
  const results: Record<string, string> = {};

  // ── PLAN BASIC ──
  console.log('▶ PLAN BASIC — Generando imágenes…');
  let t = Date.now();
  try {
    const basic = await generateBasicImages(input);
    timings['basic'] = Date.now() - t;
    results['basic_feed.jpg']  = basic.feed;
    results['basic_story.jpg'] = basic.story;
    console.log(`  ✓ basic_feed.jpg    → ${formatSize(basic.feed)}`);
    console.log(`  ✓ basic_story.jpg   → ${formatSize(basic.story)}`);
    console.log(`  ⏱  ${(timings['basic'] / 1000).toFixed(1)}s\n`);
  } catch (err) {
    console.error(`  ✗ Error en Basic: ${(err as Error).message}\n`);
  }

  // ── PLAN PROFESSIONAL ──
  console.log('▶ PLAN PROFESSIONAL — Generando videos con Ken Burns…');
  console.log('  (El proceso de Ken Burns puede tardar 1-2 minutos por video)');
  t = Date.now();
  try {
    const pro = await generateProfessionalVideos(input);
    timings['professional'] = Date.now() - t;
    results['professional_feed.mp4']  = pro.feed;
    results['professional_story.mp4'] = pro.story;
    console.log(`  ✓ professional_feed.mp4   → ${formatSize(pro.feed)}`);
    console.log(`  ✓ professional_story.mp4  → ${formatSize(pro.story)}`);
    console.log(`  ⏱  ${(timings['professional'] / 1000).toFixed(1)}s\n`);
  } catch (err) {
    console.error(`  ✗ Error en Professional: ${(err as Error).message}\n`);
  }

  // ── PLAN PREMIUM ──
  console.log('▶ PLAN PREMIUM — Generando reel de 4 clips (32s)…');
  console.log('  (4 clips × 8s = 32s en total, puede tardar 3-5 minutos)');
  t = Date.now();
  try {
    const premium = await generatePremiumReel(input);
    timings['premium'] = Date.now() - t;
    results['premium_reel.mp4'] = premium.reel;
    console.log(`  ✓ premium_reel.mp4  → ${formatSize(premium.reel)}`);
    console.log(`  ⏱  ${(timings['premium'] / 1000).toFixed(1)}s\n`);
  } catch (err) {
    console.error(`  ✗ Error en Premium: ${(err as Error).message}\n`);
  }

  // ── SUMMARY ──
  console.log('══════════════════════════════════════════════');
  console.log('  ARCHIVOS GENERADOS EN backend/test-output/');
  console.log('══════════════════════════════════════════════\n');

  const allFiles = [
    'basic_feed.jpg',
    'basic_story.jpg',
    'professional_feed.mp4',
    'professional_story.mp4',
    'premium_reel.mp4',
  ];

  for (const file of allFiles) {
    const filePath = path.join(OUTPUT_DIR, file);
    const exists   = fs.existsSync(filePath);
    const size     = exists ? formatSize(filePath) : '—';
    const status   = exists ? '✓' : '✗';
    console.log(`  ${status}  ${file.padEnd(28)} ${size}`);
  }

  console.log('\n  Archivos temporales (_tmp_*) puedes eliminarlos con:');
  console.log(`  del "${OUTPUT_DIR}\\_tmp_*"\n`);
}

function formatSize(filePath: string): string {
  try {
    const bytes = fs.statSync(filePath).size;
    if (bytes > 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  } catch {
    return '?';
  }
}

main().catch(err => {
  console.error('\n✗ Error fatal:', err.message);
  process.exit(1);
});
