/**
 * Quick test for generateKling3Video()
 *
 * Run:
 *   npx ts-node --transpile-only src/scripts/testKling3.ts
 */

// Placeholders so env.ts doesn't throw on transitive imports
if (!process.env.JWT_SECRET)     process.env.JWT_SECRET     = 'standalone-test-script-placeholder';
if (!process.env.ENCRYPTION_KEY) process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';

import path from 'path';
import fs   from 'fs';

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

import { generateKling3Video } from '../services/contentGeneration.service';

const OUTPUT_DIR = path.join(__dirname, '../../test-output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const input = {
  businessName:  'Test Auto Detailing',
  visualConcept: 'Shiny black car being detailed in professional garage warm lighting cinematic',
  copyText:      'Premium detailing service',
  primaryColor:  '#1A1A1A',
  outputDir:     OUTPUT_DIR,
  campaignId:    'test-kling3',
};

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Kling 3.0 — Direct call test');
  console.log('══════════════════════════════════════════════\n');
  console.log(`Output dir: ${OUTPUT_DIR}\n`);
  console.log(`Prompt: "${input.visualConcept}"\n`);

  const start = Date.now();
  try {
    const resultPath = await generateKling3Video(input, OUTPUT_DIR);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (resultPath) {
      const size = fs.statSync(resultPath).size;
      console.log('\n✅  SUCCESS');
      console.log(`   File : ${resultPath}`);
      console.log(`   Size : ${(size / 1024).toFixed(0)} KB`);
      console.log(`   Time : ${elapsed}s`);
    } else {
      console.log('\n⚠️  generateKling3Video returned null (no visualConcept or skipped)');
      console.log(`   Time : ${elapsed}s`);
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n❌  ERROR');
    console.log(`   Message : ${(err as Error).message}`);
    console.log(`   Time    : ${elapsed}s`);
  }

  console.log('\n══════════════════════════════════════════════\n');
}

main();
