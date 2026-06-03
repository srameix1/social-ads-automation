/**
 * E2E test — Gemini image generation integration
 *
 * Run with:
 *   npm run test:gemini
 *
 * What it tests:
 *   1. Placeholder fallback — forced by injecting an invalid key at runtime
 *   2. Real Gemini API    — requires GEMINI_API_KEY with billing enabled
 *   3. File persistence   — verifies images are saved to disk and have content
 */

import path   from 'path';
import fs     from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import after dotenv so env is populated
import { generateMediaVariations } from '../src/services/nanabanana.service';
import { env } from '../src/config/env';

const CAMPAIGN_ID = 'test-campaign-e2e';
const STRATEGY_ID = 'test-strategy-e2e';
const UPLOADS_DIR = path.resolve(process.env['UPLOADS_DIR'] ?? './uploads');

// ── Helpers ────────────────────────────────────────────────────────────────

function pass(msg: string): void { console.log(`  ✅ ${msg}`); }
function fail(msg: string): void { console.error(`  ❌ ${msg}`); process.exitCode = 1; }

function cleanupTestFiles(): void {
  const dir = path.join(UPLOADS_DIR, 'generated', CAMPAIGN_ID, STRATEGY_ID);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function assertLocalFile(url: string, label: string): void {
  if (!url.startsWith('/uploads/generated/')) {
    fail(`${label}: URL no es un path local — ${url}`);
    return;
  }
  const filePath = path.join(UPLOADS_DIR, url.replace('/uploads/', ''));
  if (!fs.existsSync(filePath)) {
    fail(`${label}: archivo no encontrado en disco — ${filePath}`);
    return;
  }
  const size = fs.statSync(filePath).size;
  if (size < 1024) {
    fail(`${label}: archivo demasiado pequeño (${size} bytes)`);
    return;
  }
  pass(`${label}: ${Math.round(size / 1024)} KB guardados → ${url}`);
}

// ── Test 1: Placeholder fallback ───────────────────────────────────────────

async function testPlaceholderFallback(): Promise<void> {
  console.log('\n[Test 1] Placeholder fallback (clave inválida inyectada en runtime)');

  // env is a plain JS object at runtime — we can mutate it even though
  // TypeScript types it as const, to simulate a missing/wrong key.
  const realKey = (env as Record<string, string>)['GEMINI_API_KEY'];
  (env as Record<string, string>)['GEMINI_API_KEY'] = 'invalid-key-for-testing';

  try {
    const result = await generateMediaVariations({
      prompt:        'Modern cafe interior',
      businessName:  'Café Prueba',
      copyText:      'El mejor café',
      strategyTitle: 'Test fallback',
      clientPhotos:  [],
      campaignId:    CAMPAIGN_ID,
      strategyId:    STRATEGY_ID,
    });

    if (result.square.includes('placehold.co'))     pass('square     → placeholder URL');
    else                                            fail(`square URL inesperada: ${result.square}`);
    if (result.vertical.includes('placehold.co'))   pass('vertical   → placeholder URL');
    else                                            fail(`vertical URL inesperada: ${result.vertical}`);
    if (result.horizontal.includes('placehold.co')) pass('horizontal → placeholder URL');
    else                                            fail(`horizontal URL inesperada: ${result.horizontal}`);
    if (result.jobId.startsWith('gemini-'))         pass('jobId tiene formato correcto');
    else                                            fail(`jobId inesperado: ${result.jobId}`);
  } finally {
    (env as Record<string, string>)['GEMINI_API_KEY'] = realKey;
  }
}

// ── Test 2: Real Gemini API ────────────────────────────────────────────────

async function testRealGeminiAPI(): Promise<void> {
  const apiKey = (env as Record<string, string>)['GEMINI_API_KEY'];

  if (!apiKey) {
    console.log('\n[Test 2] API real — OMITIDO (GEMINI_API_KEY no configurada)');
    return;
  }

  console.log('\n[Test 2] Llamada real a Gemini API (billing requerido)');
  console.log('         Generando 3 variaciones — puede tardar 30–90 segundos...\n');

  cleanupTestFiles();

  let result: Awaited<ReturnType<typeof generateMediaVariations>>;

  try {
    result = await generateMediaVariations({
      prompt:        'Elegant coffee shop with wooden tables, warm ambient lighting, artisan coffee cups on marble counter',
      businessName:  'Café Test E2E',
      copyText:      'El sabor que despierta tu mañana',
      strategyTitle: 'Campaña E2E - Prueba de integración Gemini',
      // No client photos in unit test — Gemini generates from text only
      clientPhotos:  [],
      campaignId:    CAMPAIGN_ID,
      strategyId:    STRATEGY_ID,
    });
  } catch (err) {
    fail(`generateMediaVariations lanzó excepción inesperada: ${(err as Error).message}`);
    return;
  }

  if (!result.jobId.startsWith('gemini-')) {
    fail(`jobId inesperado: ${result.jobId}`);
  } else {
    pass('jobId con prefijo correcto');
  }

  // Each variation should be a real local file (not a placeholder)
  assertLocalFile(result.square,     'square     (1:1  — Instagram feed)');
  assertLocalFile(result.vertical,   'vertical   (9:16 — Stories/TikTok)');
  assertLocalFile(result.horizontal, 'horizontal (16:9 — Facebook banner)');

  cleanupTestFiles();
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('   E2E Test — Integración Gemini Image Generation  ');
  console.log('═══════════════════════════════════════════════════');

  await testPlaceholderFallback();
  await testRealGeminiAPI();

  const code = process.exitCode ?? 0;
  console.log('\n' + '─'.repeat(51));
  console.log(code === 0 ? '✅ Todos los tests pasaron.' : '❌ Algunos tests fallaron.');
  console.log('─'.repeat(51));
  process.exit(code);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
