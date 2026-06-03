/**
 * Veo Service — Plan Premium
 *
 * Genera videos cortos de 6-8 segundos usando Google Veo 2
 * (gemini-3.1-flash-image-preview family, video generation).
 *
 * Endpoint: POST generativelanguage.googleapis.com/v1beta/models/veo-2.0-flash-001:generateContent
 * Auth:     x-goog-api-key (mismo GEMINI_API_KEY)
 *
 * El modelo Veo 2 puede usar operaciones largas (LRO). Implementamos
 * polling hasta 5 minutos con fallback a imagen estática si falla.
 *
 * Cuota: 12 videos/mes por cliente en Plan Premium.
 */

import fs   from 'fs';
import path from 'path';
import { env }    from '../config/env';
import { logger } from '../utils/logger';

const VEO_MODEL    = 'veo-2.0-generate-001';
const VEO_BASE     = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_ENDPOINT = `${VEO_BASE}/models/${VEO_MODEL}:predictLongRunning`;

const POLL_INTERVAL_MS = 5_000;   // 5 segundos entre checks
const MAX_WAIT_MS      = 300_000; // 5 minutos máximo

export interface VideoGenerationInput {
  prompt:        string;   // concepto visual de la estrategia
  businessName:  string;
  copyText:      string;
  clientPhotos:  string[]; // base64 (usadas como referencia visual)
  campaignId:    string;
  strategyId:    string;
  aspectRatio:   '9:16' | '16:9' | '1:1';
  durationSec?:  number;   // 6-8 segundos
}

export interface VideoGenerationResult {
  jobId:    string;
  filePath: string | null;  // null = falló, usar imagen fallback
  mimeType: string;
}

// ── Tipos internos de la API ───────────────────────────────────────────────

interface VeoLROResponse {
  name?:  string;   // "models/veo-2.0-generate-001/operations/xxxxx"
  done?:  boolean;
  error?: { message: string; code?: number };
  response?: {
    '@type': string;
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: { uri?: string; mimeType?: string };
      }>;
    };
  };
}

// ── Punto de entrada ───────────────────────────────────────────────────────

export async function generateVideo(input: VideoGenerationInput): Promise<VideoGenerationResult> {
  const apiKey = env.GEMINI_API_KEY;
  const jobId  = `veo-${Date.now()}`;

  if (!apiKey) {
    logger.warn('[Veo] GEMINI_API_KEY no configurada — omitiendo generación de video');
    return { jobId, filePath: null, mimeType: 'video/mp4' };
  }

  logger.info(`[Veo] Iniciando generación de video ${input.aspectRatio} para "${input.businessName}"`);

  try {
    const instances: Array<{ prompt: string; image?: { bytesBase64Encoded: string; mimeType: string } }> = [
      { prompt: buildVideoPrompt(input) },
    ];
    if (input.clientPhotos.length > 0) {
      instances[0].image = { bytesBase64Encoded: input.clientPhotos[0], mimeType: 'image/jpeg' };
    }

    const res = await fetch(VEO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        instances,
        parameters: { aspectRatio: input.aspectRatio, sampleCount: 1 },
      }),
    });

    const data = await res.json() as VeoLROResponse;

    if (!res.ok) {
      throw new Error(`Veo API ${res.status}: ${data.error?.message ?? res.statusText}`);
    }

    if (!data.name) throw new Error('Veo no devolvió nombre de operación LRO');

    logger.info(`[Veo] LRO iniciada: ${data.name}`);
    return await pollLRO(data.name, apiKey, input, jobId);
  } catch (err) {
    logger.error(`[Veo] Error generando video: ${(err as Error).message}`);
    return { jobId, filePath: null, mimeType: 'video/mp4' };
  }
}

// ── Generación de 12 videos mensuales (Plan Premium) ──────────────────────

export async function generateMonthlyVideos(params: {
  businessName: string;
  visualConcepts: string[];  // de las estrategias de Claude
  copyTexts:      string[];
  clientPhotos:   string[];
  campaignId:     string;
  strategyId:     string;
}): Promise<string[]> {
  const TARGET = 12;
  const aspectRatios: Array<'9:16' | '16:9' | '1:1'> = ['9:16', '9:16', '16:9']; // mayormente vertical para Reels
  const results: string[] = [];

  for (let i = 0; i < TARGET; i++) {
    const conceptIdx = i % (params.visualConcepts.length || 1);
    const aspectIdx  = i % aspectRatios.length;

    const result = await generateVideo({
      prompt:       params.visualConcepts[conceptIdx] ?? params.businessName,
      businessName: params.businessName,
      copyText:     params.copyTexts[conceptIdx] ?? '',
      clientPhotos: params.clientPhotos,
      campaignId:   params.campaignId,
      strategyId:   params.strategyId,
      aspectRatio:  aspectRatios[aspectIdx],
      durationSec:  6 + (i % 3),  // alterna 6, 7, 8 segundos
    });

    if (result.filePath) results.push(result.filePath);

    logger.info(`[Veo] Video ${i + 1}/${TARGET} completado`);

    // Pausa entre requests para respetar rate limits
    if (i < TARGET - 1) await sleep(3000);
  }

  logger.info(`[Veo] ${results.length}/${TARGET} videos generados exitosamente`);
  return results;
}

// ── Polling LRO ────────────────────────────────────────────────────────────

async function pollLRO(
  operationName: string,
  apiKey:        string,
  input:         VideoGenerationInput,
  jobId:         string,
): Promise<VideoGenerationResult> {
  // operationName = "models/veo-2.0-generate-001/operations/xxxxx"
  const pollUrl   = `${VEO_BASE}/${operationName}`;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(pollUrl, {
      headers: { 'x-goog-api-key': apiKey },
    });

    const op = await pollRes.json() as VeoLROResponse;

    if (op.done) {
      if (op.error) throw new Error(`LRO falló: ${op.error.message}`);

      const videoUri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) throw new Error('LRO completó pero no devolvió URI de video');

      return await downloadAndSaveVideo(videoUri, apiKey, input, jobId);
    }

    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    logger.debug(`[Veo] Polling LRO... ${elapsedSec}s transcurridos`);
  }

  throw new Error(`LRO excedió tiempo máximo de espera (${MAX_WAIT_MS / 1000}s)`);
}

// ── Descargar video desde URI y guardar a disco ────────────────────────────

async function downloadAndSaveVideo(
  videoUri: string,
  apiKey:   string,
  input:    VideoGenerationInput,
  jobId:    string,
): Promise<VideoGenerationResult> {
  const dlRes = await fetch(videoUri, { headers: { 'x-goog-api-key': apiKey } });
  if (!dlRes.ok) throw new Error(`Descarga de video fallida: ${dlRes.status}`);

  const buf      = Buffer.from(await dlRes.arrayBuffer());
  const mimeType = dlRes.headers.get('content-type') ?? 'video/mp4';
  const ext      = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const aspect   = input.aspectRatio.replace(':', 'x');
  const dir      = path.join(
    process.env['UPLOADS_DIR'] ? path.resolve(process.env['UPLOADS_DIR']) : path.resolve('./uploads'),
    'videos', input.campaignId, input.strategyId,
  );
  const filename = `${aspect}_${Date.now()}.${ext}`;

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buf);

  const filePath = `/uploads/videos/${input.campaignId}/${input.strategyId}/${filename}`;
  logger.info(`[Veo] Video guardado: ${filePath} (${Math.round(buf.length / 1024)} KB)`);

  return { jobId, filePath, mimeType };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildVideoPrompt(input: VideoGenerationInput): string {
  const aspectDesc = {
    '9:16': 'vertical 9:16 for Instagram Reels and TikTok',
    '16:9': 'horizontal 16:9 for YouTube/Facebook',
    '1:1':  'square 1:1 for Instagram feed',
  }[input.aspectRatio];

  return `Create a ${input.durationSec ?? 7}-second professional advertising video in ${aspectDesc} format.

BUSINESS: ${input.businessName}
VISUAL CONCEPT: ${input.prompt}
AD MESSAGE: ${input.copyText}

VIDEO DIRECTION:
- Show the ceramic coating process in action: application, buffing, dramatic water-beading reveal
- Include cinematic close-up shots of luxury car surfaces with mirror-like shine
- Smooth professional camera movements (slow pans, macro shots)
- Aspirational lifestyle feel: luxury cars, South Florida sun, premium service
- End on a strong hero shot of the finished car gleaming
- NO text overlays in the video (copy applied separately)
- Style: premium automotive commercial, cinematic lighting

Generate a ${input.durationSec ?? 7}-second video matching these specifications.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
