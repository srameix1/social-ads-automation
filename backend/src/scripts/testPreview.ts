/**
 * Test directo de generateVisualVariations
 * Ejecución: npx ts-node --transpile-only src/scripts/testPreview.ts
 */

if (!process.env.JWT_SECRET)     process.env.JWT_SECRET     = 'standalone-placeholder';
if (!process.env.ENCRYPTION_KEY) process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';

import path from 'path';
import fs   from 'fs';

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

import { generateVisualVariations } from '../services/contentGeneration.service';

const UPLOADS_DIR   = path.resolve(__dirname, '../../uploads');
const VARIATIONS_DIR = path.join(UPLOADS_DIR, 'variations', 'test-campaign-001');

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  TEST — generateVisualVariations');
  console.log('══════════════════════════════════════════════\n');

  console.log('GEMINI_API_KEY  present:', !!process.env.GEMINI_API_KEY);
  console.log('OPENAI_API_KEY  present:', !!process.env.OPENAI_API_KEY);
  console.log('Output dir:    ', VARIATIONS_DIR, '\n');

  if (fs.existsSync(VARIATIONS_DIR)) {
    fs.rmSync(VARIATIONS_DIR, { recursive: true });
    console.log('→ Directorio previo eliminado\n');
  }

  const t0 = Date.now();
  try {
    const results = await generateVisualVariations(
      {
        businessName:  'Bella Vita',
        description:   'Salón de belleza de lujo especializado en coloración y tratamientos capilares premium',
        visualConcept: 'Ambiente cálido y elegante de salón de belleza, tonos dorados, espejo Hollywood',
        copyText:      'Transforma tu look este verano. Reserva tu cita hoy.',
        primaryColor:  '#C9A96E',
        secondaryColor: '#1A1A1A',
        outputDir:     VARIATIONS_DIR,
        campaignId:    'test-campaign-001',
      },
      VARIATIONS_DIR,
    );

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✓ generateVisualVariations completó en ${elapsed}s\n`);

    for (const r of results) {
      const exists = fs.existsSync(r.path);
      const kb     = exists ? Math.round(fs.statSync(r.path).size / 1024) : 0;
      console.log(`  ${exists ? '✓' : '✗'}  ${path.basename(r.path)}  ${kb} KB`);
    }
  } catch (err) {
    console.error(`\n✗ ERROR: ${(err as Error).message}`);
    console.error((err as Error).stack);
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════\n');
}

main();
