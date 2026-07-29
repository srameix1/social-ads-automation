/**
 * Standalone diagnostic script — calls callGemini directly with a custom
 * prompt, outside the normal post/campaign/client flow. No DB access, no
 * post/campaign created, no quota consumed. Same pattern as test-gemini.ts.
 *
 * Run with:
 *   npm run test:gemini-image -- "PROMPT AQUI" nombre-archivo.jpg
 *
 * If nombre-archivo.jpg is omitted, a timestamped filename is used.
 * Output: backend/test-output/gemini-prompts/<nombre-archivo>
 */

import path   from 'path';
import fs     from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import after dotenv so env is populated
import { callGemini, type ContentInput } from '../src/services/contentGeneration.service';

const OUTPUT_DIR = path.join(__dirname, '../test-output/gemini-prompts');

async function main(): Promise<void> {
  const [prompt, filenameArg] = process.argv.slice(2);

  if (!prompt) {
    console.error('Uso: npm run test:gemini-image -- "PROMPT AQUI" [nombre-archivo.jpg]');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY no configurada — no se puede llamar a callGemini directamente (sin fallback).');
    process.exit(1);
  }

  const filename = filenameArg || `gemini-${Date.now()}.jpg`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  const input: ContentInput = {
    businessName:  'Prueba Diagnóstico',
    copyText:      '',
    primaryColor:  '#1A1A1A',
    visualConcept: prompt,
    outputDir:     OUTPUT_DIR,
  };

  console.log('[GEMINI IMAGE TEST] Prompt:', prompt);
  console.log('[GEMINI IMAGE TEST] Output:', outputPath);
  console.log('[GEMINI IMAGE TEST] Llamando a callGemini (1080x1080)…');

  try {
    const buffer = await callGemini(input, 1080, 1080, apiKey);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log(`[GEMINI IMAGE TEST] EXITO: ${Math.round(buffer.length / 1024)} KB guardados en ${outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`[GEMINI IMAGE TEST] FALLO: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
