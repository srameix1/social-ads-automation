import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { researchNiche, type ResearchResult } from './researchAgent.service';
import { pickAngles, type CopyAngle } from '../utils/randomSelection';
import { sendTelegramAlert } from './telegram.service';

const client = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : null;

// Detecta clave vencida/inválida en la llamada real a Anthropic y alerta de inmediato,
// sin importar si el caller termina haciendo fallback a otro proveedor.
async function alertIfClaudeAuthError(err: unknown): Promise<void> {
  if (err instanceof Anthropic.APIError && (err.status === 401 || err.status === 403)) {
    await sendTelegramAlert(
      '🔑 Anthropic/Claude devolvió error de autenticación (401/403) — la clave puede estar vencida o inválida. Verificar en EasyPanel.',
    );
  }
}

export interface StrategyDraft {
  title:          string;
  description:    string;
  copy_text:      string;
  visual_concept: string;
  tone:           string;
  target_hook:    string;
  video_hook:     string;
}

interface GenerateInput {
  businessName:    string;
  description:     string;
  objective:       string;
  targetAudience:  string;
  platforms:       string[];
}

function buildSystemPrompt(lang?: string): string {
  const langInstr = lang === 'en'
    ? 'Always respond in English. Generate all copy, strategies and content in English.'
    : lang === 'pt'
    ? 'Sempre responda em português brasileiro. Gere todo o copy, estratégias e conteúdo em português.'
    : 'Siempre respondes en español.';

  return `Eres un estratega experto en publicidad digital y copywriting emocional.
Tu trabajo es generar estrategias publicitarias que conecten profundamente
con las emociones del cliente ideal, no solo describir el producto.
${langInstr}
Siempre devuelves JSON válido, sin markdown, sin explicaciones adicionales.

Para cada estrategia debes aplicar esta metodología:
1. Identificar el DOLOR REAL detrás del problema visible
2. Identificar el DESEO OCULTO (cómo quiere sentirse el cliente)
3. Crear un ENEMIGO claro (culpable externo, no el cliente)
4. Proponer un MECANISMO ÚNICO (método/sistema/protocolo, no solo producto)
5. Describir la TRANSFORMACIÓN DE IDENTIDAD (en quién se convierte el cliente)`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

const SEP = '═══════════════════════════════════════════════════';

function buildAngleBlocks(angles: CopyAngle[]): string {
  return angles
    .map((angle, i) =>
      `${SEP}\n` +
      `ESTRATEGIA ${i + 1} — ÁNGULO OBLIGATORIO: ${angle.name}\n` +
      `${SEP}\n` +
      `${angle.instruction}\n` +
      `Tono de referencia: ${angle.toneRef}\n` +
      `REGLA: ${angle.rule}`
    )
    .join('\n\n');
}

function buildResearchBlock(result: ResearchResult | null): string {
  if (!result) return '';
  return (
    `RESEARCH INSIGHTS — use these to make copy more relevant and fresh:\n` +
    `- Current trends: ${result.trends.join(' · ')}\n` +
    `- Working angles: ${result.workingAngles.join(' · ')}\n` +
    `- Saturated angles (AVOID): ${result.saturatedAngles.join(' · ')}\n` +
    `- Customer language: ${result.vocabulary.join(', ')}\n\n`
  );
}

export async function generateAdStrategies(input: GenerateInput): Promise<StrategyDraft[]> {
  const research      = await researchNiche({ niche: input.description });
  const seed          = Date.now();
  const researchBlock = buildResearchBlock(research);
  const angles        = pickAngles(3);
  logger.info(
    `[CopyGenerator] Selected Angles: ` +
    angles.map((a, i) => `${i + 1}. ${a.name}`).join(' | ') +
    ` — IDs: ${angles.map(a => a.id).join(', ')}`,
  );
  const userPrompt = `Genera exactamente 3 estrategias publicitarias para este negocio. Cada una usa un ángulo psicológico OBLIGATORIO y diferente — no puedes mezclarlos ni intercambiarlos.

NEGOCIO: ${input.businessName}
DESCRIPCIÓN: ${input.description}
OBJETIVO DE LA CAMPAÑA: ${input.objective}
AUDIENCIA OBJETIVO: ${input.targetAudience}
PLATAFORMAS: ${input.platforms.join(', ')}

Seed de variación: ${seed} — usa este número para asegurarte de que este copy sea único y diferente a cualquier generación anterior.

${researchBlock}${buildAngleBlocks(angles)}

═══════════════════════════════════════════════════
METODOLOGÍA TRANSVERSAL (aplica a las 3)
═══════════════════════════════════════════════════
DOLOR: qué emoción negativa elimina el producto (vergüenza, frustración, miedo).
DESEO: cómo quiere sentirse el cliente (seguridad, libertad, tranquilidad).
ENEMIGO: el culpable externo, nunca el cliente.
MECANISMO: vende método/sistema/protocolo, no producto.
TRANSFORMACIÓN: en quién se convierte el cliente.

IMPORTANTE: Los 3 ángulos deben ser COMPLETAMENTE DIFERENTES entre sí. No utilices variaciones del mismo mecanismo psicológico. Cada ángulo debe apoyarse en una emoción, disparador mental y estructura narrativa distinta. El lector debe sentir que está viendo tres anuncios creados por tres marketers distintos.

Devuelve un array JSON con exactamente 3 objetos. Cada objeto debe tener:
- title: nombre de la estrategia (máx 60 caracteres)
- description: explicación aplicando dolor + deseo + enemigo (2-3 oraciones)
- copy_text: texto del anuncio listo para publicar, emocionalmente poderoso y no genérico
- visual_concept: escena física y concreta filmable por una cámara. Personas reales haciendo acciones específicas, objetos físicos concretos, lugar/ambiente real, iluminación y atmósfera. MAL EJEMPLO: "Diseño elegante con colores premium". BUEN EJEMPLO: "Técnico con guantes negros aplicando ceramic coating sobre un Tesla negro en garaje con luz LED blanca. Gotas de agua rebotando sobre la pintura en cámara lenta." El visual_concept debe convertirse directamente en instrucciones para una cámara de cine.
- tone: tono del mensaje acorde al ángulo (ej: "urgente", "aspiracional", "racional")
- target_hook: gancho principal que golpea el ángulo asignado (1 oración contundente)
- mechanism: nombre del mecanismo único para este negocio (ej: "Sistema X", "Método Y")
- transformation: en quién se convierte el cliente (1 oración)

Solo JSON, nada más.`;

  if (!client) {
    throw new Error('ANTHROPIC_API_KEY no configurada — agrega tu clave en el archivo .env');
  }

  logger.debug('[Claude] Generando estrategias para:', input.businessName);

  let response;
  try {
    response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }, { timeout: 90_000 }); // 90-second hard timeout
  } catch (err) {
    await alertIfClaudeAuthError(err);
    throw err;
  }

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude');
  }

  const strategies = parseStrategies(content.text);

  logger.debug('[Claude] Estrategias generadas correctamente');
  return strategies;
}

export interface CampaignContext {
  businessProblem: string;
  differentiator:  string;
  idealClient:     string;
  concreteResult:  string;
  clientPain:      string;
}

export interface StrategyInputForPost {
  businessName:    string;
  platforms:       string[];
  // Preferred (new campaigns): business profile from campaign + per-ad focus
  campaignContext?: CampaignContext;
  postFocus?:       string;
  // Legacy (old campaigns/posts): per-post 5 fields
  problem?:        string;
  differentiator?: string;
  idealClient?:    string;
  concreteResult?: string;
  clientPain?:     string;
  // Response language: 'es' (default) | 'en' | 'pt'
  lang?:           string;
}

export async function generateAdStrategiesForPost(input: StrategyInputForPost): Promise<StrategyDraft[]> {
  const nicheForResearch = input.campaignContext
    ? input.campaignContext.businessProblem
    : (input.problem ?? '');
  const diffForResearch = input.campaignContext
    ? input.campaignContext.differentiator
    : (input.differentiator ?? '');

  const research      = await researchNiche({ niche: nicheForResearch, differentiator: diffForResearch });
  const seed          = Date.now();
  const researchBlock = buildResearchBlock(research);

  const contextBlock = input.campaignContext
    ? `NEGOCIO: ${input.businessName}
PLATAFORMAS: ${input.platforms.join(', ')}

CONTEXTO DEL NEGOCIO (perfil de campaña):
- Problema que resuelve: ${input.campaignContext.businessProblem}
- Diferenciador: ${input.campaignContext.differentiator}
- Cliente ideal: ${input.campaignContext.idealClient}
- Resultado concreto: ${input.campaignContext.concreteResult}
- Dolor principal del cliente: ${input.campaignContext.clientPain}

FOCO ESPECÍFICO DE ESTE ANUNCIO:
${input.postFocus?.trim() || '(resaltar el diferenciador principal del negocio)'}

INSTRUCCIÓN: Las 3 estrategias deben destacar específicamente "${input.postFocus?.trim() || 'el diferenciador principal'}" usando el contexto completo del negocio arriba.`
    : `NEGOCIO: ${input.businessName}
PROBLEMA QUE RESUELVE: ${input.problem ?? ''}
DIFERENCIADOR: ${input.differentiator ?? ''}
CLIENTE IDEAL: ${input.idealClient ?? ''}
RESULTADO CONCRETO: ${input.concreteResult ?? ''}
DOLOR PRINCIPAL DEL CLIENTE: ${input.clientPain ?? ''}
PLATAFORMAS: ${input.platforms.join(', ')}`;

  const angles        = pickAngles(3);
  logger.info(
    `[CopyGenerator] Selected Angles: ` +
    angles.map((a, i) => `${i + 1}. ${a.name}`).join(' | ') +
    ` — IDs: ${angles.map(a => a.id).join(', ')}`,
  );
  const userPrompt = `Genera exactamente 3 estrategias publicitarias para este negocio. Cada una usa un ángulo psicológico OBLIGATORIO y diferente — no puedes mezclarlos ni intercambiarlos.

${contextBlock}

Seed de variación: ${seed} — usa este número para asegurarte de que este copy sea único y diferente a cualquier generación anterior.

${researchBlock}${buildAngleBlocks(angles)}

═══════════════════════════════════════════════════
METODOLOGÍA TRANSVERSAL (aplica a las 3)
═══════════════════════════════════════════════════
DOLOR: qué emoción negativa elimina el producto (vergüenza, frustración, miedo).
DESEO: cómo quiere sentirse el cliente (seguridad, libertad, tranquilidad).
ENEMIGO: el culpable externo, nunca el cliente.
MECANISMO: vende método/sistema/protocolo, no producto.
TRANSFORMACIÓN: en quién se convierte el cliente.

IMPORTANTE: Los 3 ángulos deben ser COMPLETAMENTE DIFERENTES entre sí. No utilices variaciones del mismo mecanismo psicológico. Cada ángulo debe apoyarse en una emoción, disparador mental y estructura narrativa distinta. El lector debe sentir que está viendo tres anuncios creados por tres marketers distintos.

Devuelve un array JSON con exactamente 3 objetos con:
- title (máx 60 chars)
- description (2-3 oraciones: dolor + deseo + enemigo)
- copy_text (texto del anuncio listo para publicar, no genérico)
- visual_concept: escena física y concreta filmable por una cámara. Personas reales haciendo acciones específicas, objetos físicos concretos, lugar/ambiente real, iluminación y atmósfera. MAL EJEMPLO: "Diseño elegante con colores premium". BUEN EJEMPLO: "Técnico con guantes negros aplicando ceramic coating sobre un Tesla negro en garaje con luz LED blanca. Gotas de agua rebotando sobre la pintura en cámara lenta." El visual_concept debe convertirse directamente en instrucciones para una cámara de cine.
- tone (acorde al ángulo: "urgente", "aspiracional", "racional")
- target_hook (gancho principal que golpea el ángulo asignado, 1 oración contundente)

Solo JSON, nada más.`;

  if (!client) {
    throw new Error('ANTHROPIC_API_KEY no configurada — agrega tu clave en el archivo .env');
  }

  let response;
  try {
    response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 4096,
      system:     buildSystemPrompt(input.lang),
      messages: [{ role: 'user', content: userPrompt }],
    }, { timeout: 90_000 });
  } catch (err) {
    await alertIfClaudeAuthError(err);
    throw err;
  }

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Respuesta inesperada de Claude');

  const drafts = parseStrategies(content.text);

  const hooks = await Promise.all(
    drafts.map(d => generateVideoHook({ copyText: d.copy_text, lang: input.lang })),
  );
  drafts.forEach((d, i) => { d.video_hook = hooks[i]; });

  return drafts;
}

// ── Video Hook Generation (short overlay hook, separate from copy_text) ───

export interface VideoHookInput {
  copyText: string;
  lang?:    string;
}

function fallbackVideoHook(copyText: string): string {
  const trimmed = copyText.trim();
  const match   = trimmed.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : trimmed).trim();
}

export async function generateVideoHook(input: VideoHookInput): Promise<string> {
  if (!client) return fallbackVideoHook(input.copyText);

  const langInstr = input.lang === 'en'
    ? 'Respond in English.'
    : input.lang === 'pt'
    ? 'Responda em português brasileiro.'
    : 'Responde en español.';

  const systemPrompt =
    'Eres un experto en hooks para video de redes sociales (Reels/TikTok). ' +
    'Tu única tarea es convertir un copy publicitario largo en un titular corto ' +
    'que detenga el scroll en 1 segundo. No resumes el copy ni lo cortas — creas ' +
    `un gancho propio, nuevo. ${langInstr} Responde solo con el texto del gancho, ` +
    'sin comillas, sin explicaciones.';

  const userPrompt = `COPY COMPLETO DEL ANUNCIO (contexto — no lo repitas literal ni lo cortes):
"${input.copyText}"

Genera UN gancho de video basado en este copy, para superponer como texto en los primeros segundos del video.

REGLAS:
- Máximo 8-10 palabras.
- Estilo TITULAR, no oración descriptiva. No hace falta punto final.
- Debe tener tensión o intriga real — antecede al copy, no lo resume.
- Debe ser una idea completa en sí misma, nunca una frase cortada a la mitad.
- No puede contradecir ni repetir textualmente el copy de arriba.

EJEMPLO DE MAL GANCHO (oración larga cortada a la mitad — esto es exactamente lo que NO quiero):
"Algo cambió en la limpieza de casas en Boca Ra..."

EJEMPLO DE BUEN GANCHO (titular corto, completo, con gancho real):
"Boca Raton ya no paga de más por limpieza."

Devuelve SOLO el texto del gancho, nada más.`;

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }, { timeout: 15_000 });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('unexpected response type');
    const hook = content.text.trim().replace(/^["']|["']$/g, '').trim();
    return hook || fallbackVideoHook(input.copyText);
  } catch (err) {
    await alertIfClaudeAuthError(err);
    logger.warn(`[Claude] generateVideoHook failed: ${(err as Error).message} — using fallback`);
    return fallbackVideoHook(input.copyText);
  }
}

// ── Video Prompt Generation (UGC framework) ───────────────────────────────

const CAR_DETAILING_RE =
  /ceramic\s*coating|car\s*detail|auto\s*detail|paint\s*protection|detailing|applicator\s*pad/i;

const CAR_DETAILING_NOTE =
  'PRODUCT APPLICATION NOTE: The ceramic coating is a very thin, light liquid ' +
  '(NOT gel, NOT oil, NOT viscous). When applied with a microfiber applicator pad, ' +
  'it barely dampens the surface with an almost invisible thin film. ' +
  'The motion is smooth and light, like wiping with a slightly damp cloth. ' +
  'No thick drips, no glossy gel streaks, no oil-like viscosity.';

export interface VideoPromptInput {
  visualConcept: string;
  businessName:  string;
  copyText:      string;
  businessType:  string;
  primaryColor:  string;
}

function buildFallbackVideoPrompt(input: VideoPromptInput): string {
  const businessType = input.businessType || 'this business';
  const scene = input.visualConcept || `professional scene for ${businessType}`;
  return [
    'DURATION: 8 seconds',
    'ASPECT RATIO: 9:16',
    `STYLE: Cinematic advertising video for a ${businessType}, warm natural lighting, premium look`,
    'CAMERA STYLE: Slow dolly push-in, gentle pan, subtle zoom, rack focus on subject',
    `SCENE 1 (0s-3s): ${scene}. Opening establishing shot with warm lighting.`,
    'SCENE 2 (3s-6s): Close-up detail shot highlighting the key subject. Soft bokeh background.',
    'SCENE 3 (6s-8s): Hero shot — premium aspirational still frame of the main subject.',
    'LIGHTING: Warm natural or studio lighting, well-exposed, high key with soft shadows',
    'ATMOSPHERE: premium, authentic, aspirational, professional, warm',
    'NEGATIVE PROMPT: no text, no logos, no watermarks, no brand names or business names rendered as visible text, no storefront signage with text, no dark moody lighting, no abstract visuals, no CGI, no animation, no glowing effects',
  ].join('\n');
}

export async function generateVideoPrompt(input: VideoPromptInput): Promise<string> {
  if (!client) return buildFallbackVideoPrompt(input);

  const carNote = CAR_DETAILING_RE.test(input.visualConcept) ? `\n${CAR_DETAILING_NOTE}` : '';

  const systemPrompt =
    'You are a professional cinematographer and UGC video director specializing in social media advertising. ' +
    'Transform a business concept into a precise, filmable video prompt for AI video generation models (Kling, Veo 2, Seedance). ' +
    'Always respond in English with the exact structured format requested. No markdown, no explanations, no extra text.';

  const userPrompt = `Generate a complete cinematographic video prompt for this business ad.

BUSINESS: ${input.businessName}
BUSINESS TYPE: ${input.businessType}
VISUAL CONCEPT: ${input.visualConcept}
AD COPY: ${input.copyText}
BRAND COLOR: ${input.primaryColor}${carNote}

IMPORTANT: BUSINESS is background context only, to help you understand what
kind of business this is — it must NEVER appear as visible text, a sign, a
storefront logo, or any written brand name inside the scene you describe.
Describe generic, unbranded scenes (people, product, environment) only.

Return EXACTLY this structure — no extra text, no markdown, no empty lines between sections:
DURATION: 8 seconds
ASPECT RATIO: 9:16
STYLE: [visual style matching business type — 1 sentence]
CAMERA STYLE: [3-4 specific movements: slow push-in, rack focus, etc.]
SCENE 1 (0s-3s): [subject, action, environment, lighting — 1-2 sentences]
SCENE 2 (3s-6s): [subject, action, environment, lighting — 1-2 sentences]
SCENE 3 (6s-8s): [hero or CTA moment — 1-2 sentences]
LIGHTING: [specific setup: sources, direction, color temperature]
ATMOSPHERE: [5-8 mood keywords, comma-separated]
NEGATIVE PROMPT: [10-15 things to avoid, comma-separated]`;

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }, { timeout: 15_000 });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('unexpected response type');
    return content.text.trim();
  } catch (err) {
    await alertIfClaudeAuthError(err);
    logger.warn(`[Claude] generateVideoPrompt failed: ${(err as Error).message} — using fallback`);
    return buildFallbackVideoPrompt(input);
  }
}

function parseStrategies(text: string): StrategyDraft[] {
  const attempts: Array<() => StrategyDraft[]> = [
    // 1. Parse directo
    () => JSON.parse(text),

    // 2. Extraer bloque de código markdown ```json ... ```
    () => {
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (!m) throw new Error('no match');
      return JSON.parse(m[1].trim());
    },

    // 3. Extraer el array [ ... ] más externo
    () => {
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new Error('no match');
      return JSON.parse(m[0]);
    },

    // 4. Limpiar trailing commas y reintentar array
    () => {
      const cleaned = text
        .replace(/,\s*([\]}])/g, '$1')   // trailing commas
        .replace(/[ -]/g, ' '); // control chars
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (!m) throw new Error('no match');
      return JSON.parse(m[0]);
    },
  ];

  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (Array.isArray(result) && result.length === 3) return result;
      if (Array.isArray(result) && result.length > 0) {
        logger.warn(`[Claude] JSON parseado pero tiene ${result.length} estrategias, se esperaban 3`);
        return result.slice(0, 3) as StrategyDraft[];
      }
    } catch {
      // intentar el siguiente método
    }
  }

  logger.error('[Claude] Respuesta cruda:', text.slice(0, 500));
  throw new Error('Claude no devolvió JSON válido después de todos los intentos de parseo');
}
