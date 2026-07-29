// Standalone diagnostic script for the PRODUCTION container — plain CommonJS,
// no ts-node, no imports from src/. Targets the compiled dist/ output that's
// already running in production, so it only works after a Force Rebuild has
// picked up a src/ change that touches contentGeneration.service.ts.
//
// Not part of the Docker image — copy it into the running container with
// `docker cp` when you need to diagnose, run it, then discard it.
//
// Usage inside the container (WORKDIR is /app):
//   node scripts/test-gemini-image.cjs "PROMPT AQUI" nombre-archivo.jpg
//
// No toca la base de datos, no crea post/campaña, no cuenta contra cupos.

const path = require('path');
const fs   = require('fs');

const { callGemini } = require(path.join(__dirname, '../dist/services/contentGeneration.service.js'));

const OUTPUT_DIR = path.join(__dirname, '../test-output/gemini-prompts');

async function main() {
  const [prompt, filenameArg] = process.argv.slice(2);

  if (!prompt) {
    console.error('Uso: node test-gemini-image.cjs "PROMPT AQUI" [nombre-archivo.jpg]');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('FALLO: GEMINI_API_KEY no está presente en el entorno del contenedor.');
    process.exit(1);
  }

  const filename   = filenameArg || `gemini-${Date.now()}.jpg`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  const input = {
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
    console.error(`[GEMINI IMAGE TEST] FALLO: ${err.message}`);
    process.exit(1);
  }
}

main();
