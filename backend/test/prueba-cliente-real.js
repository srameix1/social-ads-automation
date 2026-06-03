'use strict';

/**
 * prueba-cliente-real.js
 *
 * Simulación completa del flujo de producción para:
 *   Negocio: CardetailingWP — EcoSteamG by RAMEIX LLC
 *   Servicio: Ceramic Coating móvil para autos de lujo — West Palm Beach, FL
 *
 * Flujo:
 *   1. Lee la foto del negocio (logo) como base64
 *   2. Llama a Claude para generar 3 estrategias publicitarias reales
 *   3. Llama a Gemini para generar imágenes en 3 formatos por estrategia
 *   4. Guarda todo en disco
 *   5. Muestra el resumen de lo que se publicaría en cada red social
 *
 * Uso:
 *   npm run test:cliente-real
 */

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Anthropic = require('@anthropic-ai/sdk');

// ── Configuración del negocio ─────────────────────────────────────────────

const NEGOCIO = {
  nombre:      'CardetailingWP — EcoSteamG by RAMEIX LLC',
  descripcion: 'Servicio móvil de Ceramic Coating profesional para autos de lujo en West Palm Beach, Florida. ' +
               'Aplicamos recubrimiento cerámico de alta gama que protege la pintura del auto, da brillo espejo ' +
               'y repele agua y suciedad por años. Vamos al lugar del cliente — sin necesidad de llevar el auto a ningún taller.',
  objetivo:    'Conseguir clientes nuevos dueños de autos de lujo en West Palm Beach y Palm Beach County ' +
               'que quieran proteger y realzar el valor de su vehículo con el mejor ceramic coating del mercado.',
  audiencia:   'Dueños de autos de lujo (BMW, Mercedes, Porsche, Tesla, Range Rover) de 30–55 años, ' +
               'residentes de West Palm Beach, Palm Beach Gardens, Wellington y Jupiter, FL. ' +
               'Ingresos altos, valoran la calidad y la comodidad de servicio a domicilio.',
  plataformas: ['instagram', 'facebook', 'tiktok'],
};

const FOTO_NEGOCIO = path.join(
  'c:/Users/srame/OneDrive/Desktop/CAR DETAILING WP/LOGO DOT/LOGO TARJETA DOT.jpg',
);

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

const DIRECTORIO_SALIDA = path.join(__dirname, '../uploads/cardetailingwp-prueba');

const ASPECT_CONFIGS = [
  { tag: 'square',     label: '1:1 square (1080×1080 px) — Instagram feed / Facebook post' },
  { tag: 'vertical',   label: '9:16 vertical (1080×1920 px) — Instagram Stories / TikTok / Reels' },
  { tag: 'horizontal', label: '16:9 horizontal banner (1920×1080 px) — Facebook banner' },
];

// ── Utilidades ─────────────────────────────────────────────────────────────

function separador(titulo) {
  const linea = '═'.repeat(60);
  console.log(`\n${linea}`);
  if (titulo) console.log(`  ${titulo}`);
  console.log(linea);
}

function paso(num, texto) {
  console.log(`\n▶ PASO ${num}: ${texto}`);
}

function ok(texto)    { console.log(`  ✅ ${texto}`); }
function info(texto)  { console.log(`  ℹ  ${texto}`); }
function warn(texto)  { console.log(`  ⚠  ${texto}`); }
function error(texto) { console.error(`  ❌ ${texto}`); }

function leerImagenBase64(rutaArchivo) {
  if (!fs.existsSync(rutaArchivo)) {
    throw new Error(`Imagen no encontrada: ${rutaArchivo}`);
  }
  const buffer = fs.readFileSync(rutaArchivo);
  return buffer.toString('base64');
}

function detectarMime(base64) {
  const head = base64.slice(0, 12);
  if (head.startsWith('/9j/'))  return 'image/jpeg';
  if (head.startsWith('iVBOR')) return 'image/png';
  if (head.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

function platformVariation(variations, platform) {
  if (platform === 'tiktok')   return variations.vertical;
  if (platform === 'facebook') return variations.horizontal;
  return variations.square;
}

// ── PASO 1: Generar estrategias con Claude ─────────────────────────────────

async function generarEstrategias() {
  paso(1, 'Generando 3 estrategias publicitarias con Claude AI...');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `Eres un estratega experto en publicidad digital para redes sociales.
Tu trabajo es generar estrategias publicitarias concretas, creativas y listas para ejecutar.
Siempre respondes en español.
Siempre devuelves JSON válido, sin markdown, sin explicaciones adicionales.`;

  const userPrompt = `Genera exactamente 3 estrategias publicitarias distintas para este negocio.

NEGOCIO: ${NEGOCIO.nombre}
DESCRIPCIÓN: ${NEGOCIO.descripcion}
OBJETIVO DE LA CAMPAÑA: ${NEGOCIO.objetivo}
AUDIENCIA OBJETIVO: ${NEGOCIO.audiencia}
PLATAFORMAS: ${NEGOCIO.plataformas.join(', ')}

Cada estrategia debe ser radicalmente diferente en tono, enfoque y ángulo creativo.

Devuelve un array JSON con exactamente 3 objetos. Cada objeto debe tener:
- title: nombre de la estrategia (máx 60 caracteres)
- description: explicación de la estrategia (2-3 oraciones)
- copy_text: texto del anuncio listo para publicar (natural, no genérico, max 280 caracteres)
- visual_concept: descripción detallada de la imagen o video para crear (2-3 oraciones)
- tone: tono del mensaje (ej: "profesional", "exclusivo", "aspiracional", "urgente")
- target_hook: gancho principal que captura la atención (1 oración contundente, max 80 caracteres)

Solo JSON, nada más.`;

  const response = await anthropic.messages.create({
    model:      'claude-opus-4-7',
    max_tokens: 4096,
    system: [
      {
        type:          'text',
        text:          systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Encontrar el bloque de texto (puede haber bloques thinking antes)
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Claude no devolvió un bloque de texto');
  const texto = textBlock.text;

  // Parsear JSON con fallbacks progresivos
  let estrategias;
  const intentos = [
    () => JSON.parse(texto),
    () => { const m = texto.match(/```(?:json)?\s*([\s\S]*?)```/); if (!m) throw new Error('no codeblock'); return JSON.parse(m[1].trim()); },
    () => { const m = texto.match(/\[[\s\S]*\]/); if (!m) throw new Error('no array'); return JSON.parse(m[0]); },
    () => { const cleaned = texto.replace(/,\s*([\]}])/g, '$1'); const m = cleaned.match(/\[[\s\S]*\]/); if (!m) throw new Error('no array cleaned'); return JSON.parse(m[0]); },
  ];

  for (const intento of intentos) {
    try { estrategias = intento(); if (Array.isArray(estrategias) && estrategias.length > 0) break; } catch {}
  }

  if (!Array.isArray(estrategias) || estrategias.length === 0) {
    info(`Respuesta cruda de Claude (primeros 300 chars): ${texto.slice(0, 300)}`);
    throw new Error('Claude no devolvió un array JSON válido');
  }

  ok(`${estrategias.length} estrategias generadas`);
  estrategias.forEach((e, i) => {
    console.log(`\n     [${i + 1}] ${e.title}`);
    console.log(`         Tono: ${e.tone}`);
    console.log(`         Hook: "${e.target_hook}"`);
  });

  return estrategias;
}

// ── PASO 2: Generar imágenes con Gemini ───────────────────────────────────

async function generarImagenesGemini(estrategia, fotoBase64, indice) {
  paso(2, `Generando imágenes para estrategia ${indice + 1}: "${estrategia.title}"`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const jobId      = `gemini-${Date.now()}`;
  const results    = { square: null, vertical: null, horizontal: null, jobId };
  const dirSalida  = path.join(DIRECTORIO_SALIDA, `estrategia-${indice + 1}`);
  fs.mkdirSync(dirSalida, { recursive: true });

  const promptBase = `Eres un director creativo de publicidad de lujo. Genera una imagen publicitaria de alta gama.

NEGOCIO: ${NEGOCIO.nombre}
ESTRATEGIA: ${estrategia.title}
COPY DEL ANUNCIO: ${estrategia.copy_text}
CONCEPTO VISUAL: ${estrategia.visual_concept}
TONO: ${estrategia.tone}
AUDIENCIA: Dueños de autos de lujo en West Palm Beach, FL

REGLAS IMPORTANTES:
- NO incluir texto ni tipografía en la imagen (el copy se agrega por separado)
- Estilo: fotografía comercial de lujo, ultra realista, alta definición
- Ambiente: profesional, elegante, aspiracional
- Incluir elementos visuales de: ceramic coating, autos de lujo, brillo espejo, West Palm Beach
- Usar como referencia visual el logo del negocio adjunto (EcoSteamG - Ceramic Coating Expert)`;

  for (const aspect of ASPECT_CONFIGS) {
    const prompt = `${promptBase}\n\nFORMATO: ${aspect.label}\n\nGenera exactamente una imagen publicitaria con estas especificaciones.`;

    info(`Generando variación ${aspect.tag} (${aspect.label.split('—')[0].trim()})...`);

    try {
      const partes = [
        { text: prompt },
        { inlineData: { mimeType: detectarMime(fotoBase64), data: fotoBase64 } },
      ];

      const res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: partes }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(`Gemini ${res.status}: ${data.error?.message ?? res.statusText}`);
      }

      const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
      if (!imagePart?.inlineData?.data) {
        throw new Error('Gemini no devolvió imagen en la respuesta');
      }

      const mimeType = imagePart.inlineData.mimeType;
      const ext      = mimeType.includes('png') ? 'png' : 'jpg';
      const filename = `${aspect.tag}.${ext}`;
      const filepath = path.join(dirSalida, filename);

      fs.writeFileSync(filepath, Buffer.from(imagePart.inlineData.data, 'base64'));

      const tamanoKB = Math.round(fs.statSync(filepath).size / 1024);
      results[aspect.tag] = filepath;
      ok(`${aspect.tag}: ${tamanoKB} KB → ${filename}`);

    } catch (err) {
      warn(`${aspect.tag} falló: ${err.message}`);
      results[aspect.tag] = null;
    }
  }

  return results;
}

// ── PASO 3: Mostrar resumen de publicación ─────────────────────────────────

function mostrarResumenPublicacion(estrategias, todasLasImagenes) {
  separador('RESUMEN — LO QUE SE PUBLICARÍA EN CADA RED SOCIAL');

  const configPlataformas = {
    instagram: {
      emoji:     '📸',
      nombre:    'Instagram',
      variacion: 'square',
      formato:   'Feed 1:1',
      maxCopy:   2200,
      nota:      'Incluir hashtags: #CeramicCoating #WestPalmBeach #CarDetailing #LuxuryCar #EcoSteamG',
    },
    tiktok: {
      emoji:     '🎵',
      nombre:    'TikTok',
      variacion: 'vertical',
      formato:   'Video vertical 9:16',
      maxCopy:   150,
      nota:      'El copy se usa como descripción del video. Agregar tendencias: #CarTok #DetailingLife #CeramicCoating',
    },
    facebook: {
      emoji:     '👍',
      nombre:    'Facebook',
      variacion: 'horizontal',
      formato:   'Banner 16:9',
      maxCopy:   63206,
      nota:      'Incluir botón de CTA: "Solicitar cotización" o "Llamar ahora"',
    },
  };

  estrategias.forEach((estrategia, idx) => {
    const imagenes = todasLasImagenes[idx];

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`ESTRATEGIA ${idx + 1}: ${estrategia.title.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`Descripción: ${estrategia.description}`);
    console.log(`Tono:        ${estrategia.tone}`);
    console.log(`Hook:        "${estrategia.target_hook}"`);

    for (const plataforma of NEGOCIO.plataformas) {
      const config    = configPlataformas[plataforma];
      const variacion = imagenes?.[config.variacion];

      console.log(`\n  ${config.emoji} ${config.nombre.toUpperCase()} (${config.formato})`);
      console.log(`  ${'·'.repeat(50)}`);
      console.log(`  📝 COPY A PUBLICAR:`);
      console.log(`  "${estrategia.copy_text}"`);
      console.log(`  📌 ${config.nota}`);

      if (variacion && fs.existsSync(variacion)) {
        const tamanoKB = Math.round(fs.statSync(variacion).size / 1024);
        console.log(`  🖼  IMAGEN: ${path.basename(variacion)} (${tamanoKB} KB)`);
        console.log(`      Ruta: ${variacion}`);
      } else {
        console.log(`  🖼  IMAGEN: No generada (usar placeholder o reintentar)`);
      }
    }
  });
}

// ── PASO 4: Guardar reporte JSON ───────────────────────────────────────────

function guardarReporte(estrategias, todasLasImagenes) {
  const reporte = {
    generadoEn:  new Date().toISOString(),
    negocio:     NEGOCIO.nombre,
    estrategias: estrategias.map((e, idx) => ({
      ...e,
      imagenes: todasLasImagenes[idx],
    })),
  };

  const rutaReporte = path.join(DIRECTORIO_SALIDA, 'reporte.json');
  fs.writeFileSync(rutaReporte, JSON.stringify(reporte, null, 2), 'utf-8');
  return rutaReporte;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  separador('PRUEBA CLIENTE REAL — CardetailingWP / EcoSteamG');
  console.log(`Negocio:    ${NEGOCIO.nombre}`);
  console.log(`Plataformas: ${NEGOCIO.plataformas.join(', ')}`);
  console.log(`Directorio de salida: ${DIRECTORIO_SALIDA}`);

  // Validar claves API
  if (!process.env.ANTHROPIC_API_KEY) { error('ANTHROPIC_API_KEY no configurada en .env'); process.exit(1); }
  if (!process.env.GEMINI_API_KEY)    { error('GEMINI_API_KEY no configurada en .env');    process.exit(1); }

  // Cargar foto del negocio
  paso(0, 'Cargando foto del negocio...');
  let fotoBase64;
  try {
    fotoBase64 = leerImagenBase64(FOTO_NEGOCIO);
    const tamanoKB = Math.round(Buffer.from(fotoBase64, 'base64').length / 1024);
    ok(`Logo cargado: ${tamanoKB} KB`);
    info(`Ruta: ${FOTO_NEGOCIO}`);
  } catch (err) {
    error(`No se pudo cargar la foto: ${err.message}`);
    process.exit(1);
  }

  // Generar estrategias con Claude
  let estrategias;
  try {
    estrategias = await generarEstrategias();
  } catch (err) {
    error(`Error generando estrategias: ${err.message}`);
    process.exit(1);
  }

  // Generar imágenes con Gemini para cada estrategia
  separador('GENERACIÓN DE IMÁGENES CON GEMINI');
  console.log(`Se generarán ${estrategias.length} estrategias × 3 formatos = ${estrategias.length * 3} imágenes en total`);
  console.log('(Tiempo estimado: 2–4 minutos)\n');

  const todasLasImagenes = [];
  for (let i = 0; i < estrategias.length; i++) {
    const imagenes = await generarImagenesGemini(estrategias[i], fotoBase64, i);
    todasLasImagenes.push(imagenes);
  }

  // Guardar reporte
  const rutaReporte = guardarReporte(estrategias, todasLasImagenes);
  ok(`Reporte JSON guardado: ${rutaReporte}`);

  // Mostrar resumen de publicación
  mostrarResumenPublicacion(estrategias, todasLasImagenes);

  // Resumen final
  separador('RESUMEN FINAL');
  const totalImagenes = todasLasImagenes.flatMap(img =>
    ['square', 'vertical', 'horizontal'].filter(k => img[k] && fs.existsSync(img[k]))
  ).length;

  console.log(`✅ Estrategias generadas:  ${estrategias.length}`);
  console.log(`✅ Imágenes generadas:     ${totalImagenes} / ${estrategias.length * 3}`);
  console.log(`✅ Directorio de salida:   ${DIRECTORIO_SALIDA}`);
  console.log(`✅ Reporte JSON:           ${rutaReporte}`);
  console.log(`\n💡 Para publicar en producción, el sistema conectaría automáticamente`);
  console.log(`   con las APIs de Instagram, TikTok y Facebook usando las credenciales`);
  console.log(`   cifradas del cliente almacenadas en la base de datos.`);
}

main().catch(err => {
  error(`Error fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
