/**
 * Test script — AI-Integrated Text Generation
 *
 * Genera 4 variaciones con texto integrado por DALL-E 3 / Gemini:
 *   variation_1.jpg — estilo FREE
 *   variation_2.jpg — estilo MINIMALIST
 *   variation_3.jpg — estilo BOLD
 *   variation_4.jpg — estilo ELEGANT
 *
 * Ejecución:
 *   npx ts-node --transpile-only src/scripts/testDesignDecisions.ts
 */

if (!process.env.JWT_SECRET)     process.env.JWT_SECRET     = 'standalone-test';
if (!process.env.ENCRYPTION_KEY) process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';

import path from 'path';
import fs   from 'fs';

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

import sharp from 'sharp';
import {
  generateVisualVariationsFromPhotos,
  generateVisualVariations,
  type ContentInput,
} from '../services/contentGeneration.service';

const OUTPUT_PHOTOS = path.join(__dirname, '../../test-output/integrated-text-photos');
const OUTPUT_AI     = path.join(__dirname, '../../test-output/integrated-text-ai');

const LOGO_SVG = `<svg width="180" height="60" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="60" rx="6" fill="#C9A96E"/>
  <rect x="2" y="2" width="176" height="56" rx="5" fill="none" stroke="#8B6914" stroke-width="1.5"/>
  <text x="34" y="42" font-family="Arial" font-size="36" font-weight="bold" fill="#1A1A1A">BV</text>
  <text x="70" y="25" font-family="Arial" font-size="11" letter-spacing="3" fill="#1A1A1A" opacity="0.8">BELLA</text>
  <text x="70" y="42" font-family="Arial" font-size="11" letter-spacing="3" fill="#1A1A1A" opacity="0.8">VITA</text>
</svg>`;

const input: ContentInput = {
  businessName:   'Bella Vita',
  description:    'Salón de belleza de lujo especializado en coloración, cortes y tratamientos capilares premium',
  visualConcept:  'Ambiente cálido y elegante de salón de belleza, tonos dorados, espejo con iluminación Hollywood',
  copyText:       'Transforma tu look. Reserva hoy.',
  primaryColor:   '#C9A96E',
  secondaryColor: '#1A1A1A',
  logoBuffer:     Buffer.from(LOGO_SVG),
  outputDir:      OUTPUT_PHOTOS,
  campaignId:     'test-integrated-text',
};

async function makeSamplePhoto(): Promise<Buffer> {
  const w = 1080; const h = 1080;
  const pixels = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      const tx  = x / w; const ty = y / h;
      // Warm golden-brown gradient resembling salon interior
      pixels[idx]     = Math.min(255, Math.round(160 + 70 * tx - 30 * ty));
      pixels[idx + 1] = Math.min(255, Math.round(110 + 40 * (1 - ty)));
      pixels[idx + 2] = Math.min(255, Math.round(60  + 30 * tx * ty));
    }
  }
  return sharp(pixels, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  SANADDS — AI-Integrated Text: DALL-E 3 / Gemini');
  console.log('══════════════════════════════════════════════════════════\n');

  const hasGemini  = !!process.env.GEMINI_API_KEY;
  const hasOpenAI  = !!process.env.OPENAI_API_KEY;

  console.log(`  Gemini:   ${hasGemini  ? '✓ disponible (primero)' : '✗ no configurada'}`);
  console.log(`  DALL-E 3: ${hasOpenAI  ? '✓ disponible (fallback)' : '✗ no configurada'}`);
  if (!hasGemini && !hasOpenAI) {
    console.log('\n  ⚠  Sin claves de API — se usará fondo sintético + overlay Sharp como último recurso\n');
  }

  fs.mkdirSync(OUTPUT_PHOTOS, { recursive: true });
  fs.mkdirSync(OUTPUT_AI, { recursive: true });

  // ── Test A: Client photo variations ──────────────────────────────────────
  console.log('\n── TEST A: Variaciones desde foto del cliente ──────────────\n');
  console.log('  Generando foto de muestra sintética (gradiente dorado)…\n');
  const samplePhoto = await makeSamplePhoto();

  let tA = Date.now();
  try {
    const results = await generateVisualVariationsFromPhotos(
      [samplePhoto],
      { ...input, outputDir: OUTPUT_PHOTOS },
      OUTPUT_PHOTOS,
      'basic',
    );

    console.log(`\n  ⏱  ${((Date.now() - tA) / 1000).toFixed(1)}s\n`);
    const styles = ['FREE', 'MINIMALIST', 'BOLD', 'ELEGANT'];
    for (let i = 0; i < results.length; i++) {
      const exists = fs.existsSync(results[i].path);
      console.log(`  ${exists ? '✓' : '✗'}  variation_${i + 1}.jpg  [${styles[i].padEnd(10)}]  ${formatSize(results[i].path)}`);
    }
    console.log(`\n  Output: ${OUTPUT_PHOTOS}`);
  } catch (err) {
    console.error(`  ✗ Error: ${(err as Error).message}`);
  }

  // ── Test B: AI-only variations (no client photo) ──────────────────────────
  console.log('\n\n── TEST B: Variaciones sin foto (AI genera visual + texto) ──\n');
  let tB = Date.now();
  try {
    const results = await generateVisualVariations(
      { ...input, outputDir: OUTPUT_AI },
      OUTPUT_AI,
    );

    console.log(`\n  ⏱  ${((Date.now() - tB) / 1000).toFixed(1)}s\n`);
    const styles = ['FREE', 'MINIMALIST', 'BOLD', 'ELEGANT'];
    for (let i = 0; i < results.length; i++) {
      const exists = fs.existsSync(results[i].path);
      console.log(`  ${exists ? '✓' : '✗'}  variation_${i + 1}.jpg  [${styles[i].padEnd(10)}]  ${formatSize(results[i].path)}`);
    }
    console.log(`\n  Output: ${OUTPUT_AI}`);
  } catch (err) {
    console.error(`  ✗ Error: ${(err as Error).message}`);
  }

  console.log('\n══════════════════════════════════════════════════════════\n');
}

function formatSize(p: string): string {
  try { const b = fs.statSync(p).size; return b > 1_048_576 ? `${(b/1_048_576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`; }
  catch { return '?'; }
}

main().catch(err => { console.error('\n✗ Error fatal:', err.message); process.exit(1); });
