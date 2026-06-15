/**
 * Test script — Veo 2 standalone
 *
 * Llama directamente a generateVideo() de veo.service.ts y muestra
 * el resultado completo o el error exacto. Sin DB.
 *
 * Ejecución:
 *   cd backend && npx ts-node --transpile-only src/scripts/testVeo2.ts
 */

// Must be first: env.ts lanza si JWT_SECRET / ENCRYPTION_KEY no están
if (!process.env.JWT_SECRET)     process.env.JWT_SECRET     = 'standalone-test-placeholder';
if (!process.env.ENCRYPTION_KEY) process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';

import path from 'path';

// Carga el .env real (GEMINI_API_KEY, UPLOADS_DIR, etc.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

import { generateVideo } from '../services/veo.service';

const TEST_PROMPT = 'A shiny black car being detailed in a professional garage';

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Veo 2 Test Script');
  console.log('══════════════════════════════════════════════════\n');

  const geminiKey = process.env['GEMINI_API_KEY'] ?? '';
  console.log(`GEMINI_API_KEY : ${geminiKey ? `presente — ${geminiKey.slice(0, 10)}… (longitud: ${geminiKey.length})` : '*** FALTA — Veo 2 no funcionará ***'}`);
  console.log(`UPLOADS_DIR    : ${process.env['UPLOADS_DIR'] ?? '(no seteado, usará ./uploads)'}`);
  console.log(`Prompt         : ${TEST_PROMPT}\n`);

  if (!geminiKey) {
    console.error('✗  GEMINI_API_KEY no está en el .env — abortando.');
    process.exit(1);
  }

  const startMs = Date.now();
  console.log('Llamando a generateVideo()… (puede tardar hasta 5 minutos)\n');

  try {
    const result = await generateVideo({
      prompt:       TEST_PROMPT,
      businessName: 'Test Business',
      copyText:     'Premium quality. Book now.',
      clientPhotos: [],
      campaignId:   'test-veo2',
      strategyId:   `test-${Date.now()}`,
      aspectRatio:  '9:16',
      durationSec:  8,
    });

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`\n══════════════════════════════════════════════════`);
    console.log(`  Resultado completo (${elapsed}s)`);
    console.log(`══════════════════════════════════════════════════`);
    console.log(JSON.stringify(result, null, 2));

    if (result.filePath) {
      console.log(`\n✓  Video generado: ${result.filePath}`);
    } else {
      console.log(`\n✗  filePath es null — Veo 2 falló (ver logs arriba para el error exacto)`);
    }
  } catch (err) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.error(`\n✗  Excepción no capturada después de ${elapsed}s:`);
    console.error(err);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
