'use strict';
/**
 * prueba-3-planes.js
 *
 * Genera contenido publicitario para CardetailingWP en los 3 planes:
 *   - Plan BÁSICO:        Imagen con texto del copy superpuesto por Gemini
 *   - Plan PROFESIONAL:   Imagen limpia + logo y colores de marca con Sharp
 *   - Plan PREMIUM:       Igual que Profesional + intento de video con Veo 2
 *
 * Uso: npm run test:3-planes
 */

const fs      = require('fs');
const path    = require('path');
const sharp   = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Anthropic = require('@anthropic-ai/sdk');

// ── Configuración del negocio ──────────────────────────────────────────────

const NEGOCIO = {
  nombre:      'CardetailingWP — EcoSteamG by RAMEIX LLC',
  descripcion: 'Servicio móvil de Ceramic Coating profesional para autos de lujo en West Palm Beach, FL. ' +
               'Vamos al lugar del cliente. Brillo espejo, protección UV y repelencia al agua por años.',
  objetivo:    'Conseguir clientes dueños de autos de lujo que quieran proteger su vehículo',
  audiencia:   'Dueños de BMW, Mercedes, Porsche, Tesla en West Palm Beach, Palm Beach Gardens, Jupiter, FL',
  plataformas: ['instagram', 'facebook', 'tiktok'],
};

const LOGO_PATH = 'c:/Users/srame/OneDrive/Desktop/CAR DETAILING WP/LOGO DOT/LOGO TARJETA DOT.jpg';
const BRAND = {
  primaryColor:   '#1e3a5f',  // azul marino oscuro
  secondaryColor: '#fbbf24',  // amarillo dorado
};

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';
const VEO_MODEL    = 'veo-2.0-generate-001';
const VEO_BASE     = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_ENDPOINT = `${VEO_BASE}/models/${VEO_MODEL}:predictLongRunning`;
const OUTPUT_BASE     = path.join(__dirname, '../uploads/prueba-3-planes');

// ── Helpers de logging ────────────────────────────────────────────────────

function separador(titulo) {
  console.log(`\n${'═'.repeat(65)}`);
  if (titulo) console.log(`  ${titulo}`);
  console.log('═'.repeat(65));
}
function seccion(texto)  { console.log(`\n── ${texto} ${'─'.repeat(Math.max(0, 50 - texto.length))}`); }
function ok(t)           { console.log(`  ✅ ${t}`); }
function info(t)         { console.log(`  ℹ  ${t}`); }
function warn(t)         { console.log(`  ⚠  ${t}`); }
function err(t)          { console.error(`  ❌ ${t}`); }

// ── Claude: generar una estrategia ───────────────────────────────────────

async function generarEstrategia() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `Genera exactamente 1 estrategia publicitaria para este negocio.
NEGOCIO: ${NEGOCIO.nombre}
DESCRIPCIÓN: ${NEGOCIO.descripcion}
AUDIENCIA: ${NEGOCIO.audiencia}
Devuelve SOLO un JSON con campos: title, copy_text, visual_concept, tone, target_hook, hashtags (string con hashtags separados por espacio).`;

  const res = await anthropic.messages.create({
    model: 'claude-opus-4-7', max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = res.content.find(b => b.type === 'text');
  const texto = textBlock?.text ?? '';

  // Parsear JSON con fallbacks
  for (const intento of [
    () => JSON.parse(texto),
    () => { const m = texto.match(/\{[\s\S]*\}/); if (!m) throw new Error(); return JSON.parse(m[0]); },
  ]) {
    try { const r = intento(); if (r.copy_text) return r; } catch {}
  }
  throw new Error('Claude no devolvió JSON válido');
}

// ── Gemini: generar imagen ────────────────────────────────────────────────

async function geminiGenerarImagen(prompt, logoBase64, incluirTexto, copyText, hashtags) {
  const apiKey = process.env.GEMINI_API_KEY;
  const partes = [{ text: prompt }];
  if (logoBase64) partes.push({ inlineData: { mimeType: 'image/jpeg', data: logoBase64 } });

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: partes }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message}`);
  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error('Sin imagen en respuesta de Gemini');
  return { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
}

function buildPromptBasico(estrategia, aspecto) {
  return `Eres un diseñador de publicidad para redes sociales. Genera una imagen publicitaria completa.
NEGOCIO: ${NEGOCIO.nombre}
CONCEPTO VISUAL: ${estrategia.visual_concept}
FORMATO: ${aspecto}

TEXTO QUE DEBE APARECER EN LA IMAGEN:
"${estrategia.copy_text}"
${estrategia.hashtags ? `Hashtags: ${estrategia.hashtags}` : ''}

REQUISITOS:
- Fondo visual atractivo con autos de lujo, brillo cerámico, West Palm Beach
- Texto del copy superpuesto prominente con tipografía bold y legible
- Contraste fuerte: sombra, caja de texto o bloque de color detrás del texto
- Hashtags en la parte inferior, tamaño más pequeño
- Estilo: publicidad moderna para redes sociales, vibrante, impactante
- Usa el logo del negocio adjunto como referencia de marca

Genera exactamente una imagen con el texto ya integrado en el diseño.`;
}

function buildPromptProPremium(estrategia, aspecto) {
  return `Eres un director creativo de publicidad premium. Genera una imagen publicitaria de alta gama.
NEGOCIO: ${NEGOCIO.nombre}
CAMPAÑA: ${estrategia.title}
CONCEPTO: ${estrategia.visual_concept}
TONO: ${estrategia.tone}
FORMATO: ${aspecto}

REQUISITOS:
- NO incluir texto ni tipografía (se aplica por separado)
- Fotografía comercial de lujo: autos de alta gama, ceramic coating, brillo espejo
- Dejar margen limpio en esquina inferior derecha para logo (18% del ancho)
- Paleta cromática: azul marino oscuro (#1e3a5f) y dorado (#fbbf24) - colores de marca
- Ambiente: West Palm Beach, sol de Florida, servicio móvil premium
- Ultra-realista, cinematográfico, aspiracional

Genera exactamente una imagen publicitaria limpia y de alta calidad.`;
}

async function guardarImagen(b64data, mimeType, outputPath) {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fp  = outputPath.endsWith('.jpg') || outputPath.endsWith('.png') ? outputPath : `${outputPath}.${ext}`;
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, Buffer.from(b64data, 'base64'));
  return fp;
}

// ── Sharp: aplicar branding ───────────────────────────────────────────────

async function aplicarBranding(imagePath, logoBase64, primaryColor, secondaryColor, businessName) {
  const meta = await sharp(imagePath).metadata();
  const imgW = meta.width ?? 1080;
  const imgH = meta.height ?? 1080;
  const composites = [];

  // 1. Franja de color inferior
  const stripH = Math.round(imgH * 0.07);
  const r = parseInt(primaryColor.slice(1,3), 16);
  const g = parseInt(primaryColor.slice(3,5), 16);
  const b = parseInt(primaryColor.slice(5,7), 16);
  const strip = await sharp({ create: { width: imgW, height: stripH, channels: 4, background: { r, g, b, alpha: 220 } } }).png().toBuffer();
  composites.push({ input: strip, top: imgH - stripH, left: 0, blend: 'over' });

  // 2. Logo en esquina inferior derecha
  const logoW    = Math.round(imgW * 0.18);
  const padding  = Math.round(imgW * 0.03);
  const logoResized = await sharp(Buffer.from(logoBase64, 'base64'))
    .resize(logoW, undefined, { fit: 'inside' })
    .ensureAlpha().png().toBuffer();
  const logoMeta = await sharp(logoResized).metadata();
  const logoH    = logoMeta.height ?? 80;
  composites.push({ input: logoResized, top: imgH - logoH - padding, left: imgW - logoW - padding, blend: 'over' });

  // Aplicar todo en una pasada
  const tmpPath = imagePath + '.tmp.jpg';
  await sharp(imagePath).composite(composites).jpeg({ quality: 92 }).toFile(tmpPath);
  fs.renameSync(tmpPath, imagePath);
}

// ── Veo 2: generar video ──────────────────────────────────────────────────

async function generarVideoVeo2(estrategia, logoBase64, outputDir) {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = `Create a premium automotive advertising video for ${NEGOCIO.nombre}.

CAMPAIGN: ${estrategia.title}
VISUAL CONCEPT: ${estrategia.visual_concept}

VIDEO DIRECTION:
- Dramatic ceramic coating application on a luxury sports car
- Ultra slow-motion water beading on gleaming paint surface
- Macro shots of mirror-like reflections on hood and doors
- Professional detailer working with precision tools
- Final hero shot: sun-drenched West Palm Beach with car gleaming
- Cinematic camera movements, premium automotive commercial feel
- NO text overlays — pure visual storytelling

Style: luxury automotive commercial, Miami/West Palm Beach aesthetic, aspirational`;

  const instances = [{ prompt }];
  if (logoBase64) instances[0].image = { bytesBase64Encoded: logoBase64, mimeType: 'image/jpeg' };

  // Iniciar LRO
  const res = await fetch(VEO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      instances,
      parameters: { aspectRatio: '9:16', sampleCount: 1 },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Veo2 ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`);
  if (!data.name) throw new Error(`Veo2 no devolvió LRO: ${JSON.stringify(data).slice(0, 200)}`);

  info(`LRO iniciada: ${data.name}`);

  // Polling
  const pollUrl   = `${VEO_BASE}/${data.name}`;
  const startTime = Date.now();
  const MAX_WAIT  = 5 * 60 * 1000; // 5 minutos
  const INTERVAL  = 5000;

  while (Date.now() - startTime < MAX_WAIT) {
    await new Promise(r => setTimeout(r, INTERVAL));
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r  ℹ  Polling... ${elapsed}s`);

    const pollRes = await fetch(pollUrl, { headers: { 'x-goog-api-key': apiKey } });
    const op = await pollRes.json();

    if (op.done) {
      console.log(); // nueva línea tras el polling
      if (op.error) throw new Error(`LRO error: ${op.error.message}`);

      const videoUri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) throw new Error('LRO completó pero sin URI de video');

      // Descargar el video
      const dlRes = await fetch(videoUri, { headers: { 'x-goog-api-key': apiKey } });
      if (!dlRes.ok) throw new Error(`Descarga fallida: ${dlRes.status}`);

      const buf = Buffer.from(await dlRes.arrayBuffer());
      const videoDir = path.join(outputDir, 'videos');
      fs.mkdirSync(videoDir, { recursive: true });
      const videoFp = path.join(videoDir, 'reel_9x16.mp4');
      fs.writeFileSync(videoFp, buf);

      const sizeKB = Math.round(buf.length / 1024);
      ok(`Video generado: ${sizeKB} KB → ${videoFp}`);
      return { tipo: 'archivo', ruta: videoFp };
    }
  }

  throw new Error('Polling expiró (5 min)');
}

// ── PLAN BÁSICO ───────────────────────────────────────────────────────────

async function ejecutarPlanBasico(estrategia, logoBase64) {
  seccion('PLAN BÁSICO ($97/mes) — Texto superpuesto por Gemini');
  const dir = path.join(OUTPUT_BASE, 'basico');

  const aspectos = [
    { tag: 'square',     label: '1:1 square (1080×1080 px) — Instagram feed' },
    { tag: 'vertical',   label: '9:16 vertical (1080×1920 px) — Stories / TikTok' },
    { tag: 'horizontal', label: '16:9 horizontal (1920×1080 px) — Facebook banner' },
  ];

  const resultados = {};

  for (const asp of aspectos) {
    info(`Generando ${asp.tag} con texto integrado...`);
    try {
      const promptTexto = buildPromptBasico(estrategia, asp.label);
      const img = await geminiGenerarImagen(promptTexto, logoBase64, true, estrategia.copy_text, estrategia.hashtags);
      const fp = await guardarImagen(img.data, img.mimeType, path.join(dir, `${asp.tag}.jpg`));
      const sizeKB = Math.round(fs.statSync(fp).size / 1024);
      ok(`${asp.tag}: ${sizeKB} KB — texto del copy integrado en la imagen`);
      resultados[asp.tag] = fp;
    } catch (e) {
      warn(`${asp.tag} falló: ${e.message}`);
    }
  }
  return resultados;
}

// ── PLAN PROFESIONAL ───────────────────────────────────────────────────────

async function ejecutarPlanProfesional(estrategia, logoBase64) {
  seccion('PLAN PROFESIONAL ($197/mes) — Logo + colores de marca con Sharp');
  const dir = path.join(OUTPUT_BASE, 'profesional');

  const aspectos = [
    { tag: 'square',     label: '1:1 square (1080×1080 px) — Instagram feed' },
    { tag: 'vertical',   label: '9:16 vertical (1080×1920 px) — Stories / TikTok' },
    { tag: 'horizontal', label: '16:9 horizontal (1920×1080 px) — Facebook banner' },
  ];

  const resultados = {};

  for (const asp of aspectos) {
    info(`Generando ${asp.tag} (imagen limpia)...`);
    try {
      const promptLimpio = buildPromptProPremium(estrategia, asp.label);
      const img = await geminiGenerarImagen(promptLimpio, logoBase64, false);
      const fp  = await guardarImagen(img.data, img.mimeType, path.join(dir, `${asp.tag}.jpg`));

      info(`Aplicando branding con Sharp (logo + franja de color)...`);
      await aplicarBranding(fp, logoBase64, BRAND.primaryColor, BRAND.secondaryColor, NEGOCIO.nombre);

      const sizeKB = Math.round(fs.statSync(fp).size / 1024);
      ok(`${asp.tag}: ${sizeKB} KB — logo y colores de marca aplicados`);
      resultados[asp.tag] = fp;
    } catch (e) {
      warn(`${asp.tag} falló: ${e.message}`);
    }
  }
  return resultados;
}

// ── PLAN PREMIUM ──────────────────────────────────────────────────────────

async function ejecutarPlanPremium(estrategia, logoBase64) {
  seccion('PLAN PREMIUM ($397/mes) — Igual que Profesional + Video con Veo 2');
  const dir = path.join(OUTPUT_BASE, 'premium');

  // Primero genera las 3 imágenes igual que el plan profesional
  info('Generando imágenes (igual que Plan Profesional)...');
  const aspectos = [
    { tag: 'square',     label: '1:1 square (1080×1080 px) — Instagram feed' },
    { tag: 'vertical',   label: '9:16 vertical (1080×1920 px) — Stories / TikTok' },
    { tag: 'horizontal', label: '16:9 horizontal (1920×1080 px) — Facebook banner' },
  ];
  const imagenes = {};
  for (const asp of aspectos) {
    try {
      const promptLimpio = buildPromptProPremium(estrategia, asp.label);
      const img = await geminiGenerarImagen(promptLimpio, logoBase64, false);
      const fp  = await guardarImagen(img.data, img.mimeType, path.join(dir, `${asp.tag}.jpg`));
      await aplicarBranding(fp, logoBase64, BRAND.primaryColor, BRAND.secondaryColor, NEGOCIO.nombre);
      const sizeKB = Math.round(fs.statSync(fp).size / 1024);
      ok(`imagen ${asp.tag}: ${sizeKB} KB`);
      imagenes[asp.tag] = fp;
    } catch (e) { warn(`imagen ${asp.tag} falló: ${e.message}`); }
  }

  // Luego intenta generar 1 video de muestra con Veo 2
  info('\nGenerando video de prueba con Veo 2 (9:16 vertical para Reels)...');
  info('(Esto puede tardar 30-120 segundos)');
  let videoResultado = null;
  try {
    videoResultado = await generarVideoVeo2(estrategia, logoBase64, dir);
  } catch (e) {
    warn(`Veo 2: ${e.message.slice(0, 120)}`);
    videoResultado = { tipo: 'no_disponible', razon: e.message.slice(0, 120) };
  }

  return { imagenes, video: videoResultado };
}

// ── Resumen comparativo ───────────────────────────────────────────────────

function mostrarResumen(estrategia, resultados) {
  separador('COMPARACIÓN VISUAL — Los 3 Planes');

  const planes = [
    { nombre: 'BÁSICO ($97/mes)',        dir: 'basico',       extra: 'Texto del copy integrado por Gemini' },
    { nombre: 'PROFESIONAL ($197/mes)',  dir: 'profesional',  extra: 'Logo + franja de color por Sharp' },
    { nombre: 'PREMIUM ($397/mes)',      dir: 'premium',      extra: 'Logo + color + Videos Veo 2' },
  ];

  console.log(`\nEstrategia usada: "${estrategia.title}"`);
  console.log(`Copy: "${estrategia.copy_text?.slice(0, 80)}..."`);

  for (const plan of planes) {
    console.log(`\n  📦 ${plan.nombre}`);
    console.log(`     Diferenciador: ${plan.extra}`);
    const dirPlan = path.join(OUTPUT_BASE, plan.dir);
    for (const formato of ['square', 'vertical', 'horizontal']) {
      const fp = path.join(dirPlan, `${formato}.jpg`);
      if (fs.existsSync(fp)) {
        const sizeKB = Math.round(fs.statSync(fp).size / 1024);
        console.log(`     [${formato.padEnd(10)}] ${sizeKB} KB → ${fp}`);
      } else {
        console.log(`     [${formato.padEnd(10)}] ❌ No generada`);
      }
    }
    // Video para Premium
    const videoDir = path.join(dirPlan, 'videos');
    if (fs.existsSync(videoDir)) {
      const videos = fs.readdirSync(videoDir);
      for (const v of videos) {
        const fp = path.join(videoDir, v);
        const sizeKB = Math.round(fs.statSync(fp).size / 1024);
        console.log(`     [video       ] ${sizeKB} KB → ${fp}`);
      }
    }
  }

  console.log(`\n  📁 Directorio: ${OUTPUT_BASE}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  separador('PRUEBA 3 PLANES — CardetailingWP / EcoSteamG');
  console.log(`Negocio: ${NEGOCIO.nombre}`);
  console.log(`Output:  ${OUTPUT_BASE}\n`);

  if (!process.env.ANTHROPIC_API_KEY) { err('ANTHROPIC_API_KEY no configurada'); process.exit(1); }
  if (!process.env.GEMINI_API_KEY)    { err('GEMINI_API_KEY no configurada');    process.exit(1); }

  // Cargar logo
  seccion('Cargando logo del negocio');
  if (!fs.existsSync(LOGO_PATH)) { err(`Logo no encontrado: ${LOGO_PATH}`); process.exit(1); }
  const logoBase64 = fs.readFileSync(LOGO_PATH).toString('base64');
  const logoKB     = Math.round(Buffer.from(logoBase64, 'base64').length / 1024);
  ok(`Logo cargado: ${logoKB} KB`);

  // Generar estrategia con Claude
  seccion('Generando estrategia publicitaria con Claude');
  let estrategia;
  try {
    estrategia = await generarEstrategia();
    ok(`Estrategia: "${estrategia.title}"`);
    info(`Tono: ${estrategia.tone}`);
    info(`Hook: "${estrategia.target_hook}"`);
    info(`Copy: "${estrategia.copy_text?.slice(0, 80)}..."`);
  } catch (e) { err(`Error con Claude: ${e.message}`); process.exit(1); }

  // Ejecutar cada plan
  separador('GENERANDO CONTENIDO — Los 3 Planes en Paralelo');
  console.log('(Esto puede tardar 3-8 minutos por las 9 imágenes + video)\n');

  await ejecutarPlanBasico(estrategia, logoBase64);
  await ejecutarPlanProfesional(estrategia, logoBase64);
  await ejecutarPlanPremium(estrategia, logoBase64);

  mostrarResumen(estrategia, {});

  separador('COMPLETADO');
  console.log('Abre el directorio para ver la diferencia visual entre los 3 planes:');
  console.log(`  ${OUTPUT_BASE}`);
}

main().catch(e => {
  err(`Error fatal: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
