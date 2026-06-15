/**
 * Media Generation Service — powered by Google Gemini gemini-3.1-flash-image-preview
 *
 * Flow:
 *   1. Receives client business photos (base64) + Claude strategy brief
 *   2. Builds a professional advertising prompt
 *   3. Calls Gemini API 3 times → one per aspect ratio (1:1 / 9:16 / 16:9)
 *   4. Saves each result to uploads/generated/{campaignId}/{strategyId}/
 *   5. Returns local file paths for all 3 variations
 *
 * Fallback: if GEMINI_API_KEY is missing or any call fails, returns
 * placeholder images so the rest of the pipeline continues uninterrupted.
 */

import fs   from 'fs';
import path from 'path';
import { env }    from '../config/env';
import { logger } from '../utils/logger';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

// ── Public interfaces ──────────────────────────────────────────────────────

export type ServicePlan = 'basic' | 'professional' | 'premium';

export interface MediaGenerationInput {
  prompt:        string;    // visual_concept from Claude strategy
  businessName:  string;
  copyText:      string;    // ad copy text for context
  strategyTitle: string;
  clientPhotos:  string[];  // base64-encoded JPEG/PNG (0–3 items)
  campaignId:    string;
  strategyId:    string;
  plan?:         ServicePlan;  // defaults to 'basic'
  hashtags?:     string;       // for basic plan text overlay
}

export interface MediaGenerationVariations {
  square:     string;  // 1:1  — Instagram feed / Facebook post
  vertical:   string;  // 9:16 — Stories / TikTok
  horizontal: string;  // 16:9 — Facebook banner / YouTube thumbnail
  jobId:      string;
}

/** Kept for backward compatibility with the strategies service. */
export interface MediaGenerationResult {
  jobId:      string;
  url:        string;
  type:       'image' | 'video';
  variations: Pick<MediaGenerationVariations, 'square' | 'vertical' | 'horizontal'>;
}

// ── Internal types ─────────────────────────────────────────────────────────

interface GeminiPart {
  text?:       string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message: string; code: number };
}

const ASPECT_CONFIGS = [
  {
    tag:   'square'     as const,
    label: '1:1 square format (1080×1080 px) — optimized for Instagram feed and Facebook post',
  },
  {
    tag:   'vertical'   as const,
    label: '9:16 vertical format (1080×1920 px) — optimized for Instagram Stories and TikTok',
  },
  {
    tag:   'horizontal' as const,
    label: '16:9 horizontal banner (1920×1080 px) — optimized for Facebook banner and YouTube thumbnail',
  },
] as const;

// ── Main public function ───────────────────────────────────────────────────

export async function generateMediaVariations(
  input: MediaGenerationInput,
): Promise<MediaGenerationVariations> {
  const apiKey = env.GEMINI_API_KEY;
  const jobId  = `gemini-${Date.now()}`;

  if (!apiKey) {
    logger.warn('[Gemini] GEMINI_API_KEY no configurada — usando placeholders');
    return buildPlaceholders(input.businessName, jobId);
  }

  const results: Partial<Record<'square' | 'vertical' | 'horizontal', string>> & { jobId: string } =
    { jobId };

  for (const aspect of ASPECT_CONFIGS) {
    try {
      const image = await callGeminiAPI(input, aspect.label, apiKey);
      const savedPath = await saveImage(
        image.data,
        image.mimeType,
        input.campaignId,
        input.strategyId,
        aspect.tag,
      );
      results[aspect.tag] = savedPath;
      logger.info(`[Gemini] Variación ${aspect.tag} generada: ${savedPath}`);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      logger.error(`[Gemini] Falló variación ${aspect.tag}: ${msg}`);
      results[aspect.tag] = placeholderUrl(input.businessName, aspect.tag);
    }
  }

  return results as MediaGenerationVariations;
}

/**
 * Legacy wrapper — generates all 3 variations and returns the URL
 * that best matches the requested platform.
 */
export async function generateMedia(input: {
  prompt:         string;
  type:           'image' | 'video';
  platform:       string;
  businessName:   string;
  campaignId:     string;
  strategyId:     string;
  clientPhotos?:  string[];
  copyText?:      string;
  strategyTitle?: string;
}): Promise<MediaGenerationResult> {
  const variations = await generateMediaVariations({
    prompt:        input.prompt,
    businessName:  input.businessName,
    copyText:      input.copyText      ?? '',
    strategyTitle: input.strategyTitle ?? '',
    clientPhotos:  input.clientPhotos  ?? [],
    campaignId:    input.campaignId,
    strategyId:    input.strategyId,
  });

  return {
    jobId:      variations.jobId,
    url:        pickUrlForPlatform(variations, input.platform),
    type:       input.type,
    variations: {
      square:     variations.square,
      vertical:   variations.vertical,
      horizontal: variations.horizontal,
    },
  };
}

// ── Gemini API ─────────────────────────────────────────────────────────────

async function callGeminiAPI(
  input:       MediaGenerationInput,
  aspectLabel: string,
  apiKey:      string,
): Promise<{ data: string; mimeType: string }> {
  const parts: GeminiPart[] = [
    { text: buildPrompt(input, aspectLabel) },
  ];

  // Include up to 3 client photos as visual reference
  for (const photo of input.clientPhotos.slice(0, 3)) {
    parts.push({
      inlineData: {
        mimeType: detectMimeType(photo),
        data:     photo,
      },
    });
  }

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  const data = await response.json() as GeminiResponse;

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${data.error?.message ?? response.statusText}`);
  }

  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini no devolvió imagen en la respuesta');
  }

  return {
    data:     imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(input: MediaGenerationInput, aspectLabel: string): string {
  const plan     = input.plan ?? 'basic';
  const photoLine = input.clientPhotos.length > 0
    ? 'Use the attached business photos as visual reference. Incorporate brand elements naturally into the composition.'
    : 'Create an original, compelling visual composition that represents the brand.';

  // ── Plan BÁSICO: texto y hashtags superpuestos dentro de la imagen ─────────
  if (plan === 'basic') {
    const hashtags = input.hashtags ?? '';
    return `You are a professional social media advertising designer. Generate a complete, ready-to-publish advertising image.

BUSINESS: ${input.businessName}
VISUAL CONCEPT: ${input.prompt}
FORMAT: ${aspectLabel}

TEXT TO INCLUDE IN THE IMAGE:
"${input.copyText}"
${hashtags ? `HASHTAGS: ${hashtags}` : ''}

DESIGN REQUIREMENTS:
- Create a visually attractive advertising background (photography or illustration style)
- Overlay the ad copy text prominently on the image using bold, readable typography
- The text must be clearly legible, with strong contrast against the background
- Use a text treatment that looks professional: drop shadow, text box, or color block behind the text
- Hashtags should appear smaller, at the bottom of the image
- Style: modern social media advertising, vibrant, high-impact
- ${photoLine}

Generate exactly one complete advertising image with the text already embedded.`;
  }

  // ── Plan PROFESIONAL / PREMIUM: imagen limpia (logo se aplica con Sharp después) ──
  return `You are a professional advertising creative director generating commercial advertising images.

BUSINESS: ${input.businessName}
CAMPAIGN: ${input.strategyTitle}
AD COPY CONCEPT: ${input.copyText}
VISUAL CONCEPT: ${input.prompt}

TECHNICAL SPECS:
- Format: ${aspectLabel}
- Style: High-end commercial advertising photography / luxury brand aesthetic
- Quality: Ultra-high resolution, sharp, vibrant, ready for publication
- IMPORTANT: Do NOT include any text, typography, or logos in the image (applied separately)
- Leave a clean margin area in the bottom-right corner for logo placement

DIRECTION:
${photoLine}
Create a visually striking image that communicates the campaign message at a glance.
Professional lighting, cohesive color palette, clean modern composition for social media.

Generate exactly one advertising image matching all specifications above.`;
}

// ── File storage ───────────────────────────────────────────────────────────

async function saveImage(
  base64Data: string,
  mimeType:   string,
  campaignId: string,
  strategyId: string,
  tag:        string,
): Promise<string> {
  const ext      = mimeType.includes('png') ? 'png' : 'jpg';
  const dir      = path.join(path.resolve(env.UPLOADS_DIR), 'generated', campaignId, strategyId);
  const filename = `${tag}_${Date.now()}.${ext}`;

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), Buffer.from(base64Data, 'base64'));

  // Return URL path that the Express static middleware serves
  return `/uploads/generated/${campaignId}/${strategyId}/${filename}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pickUrlForPlatform(v: MediaGenerationVariations, platform: string): string {
  if (platform === 'tiktok')   return v.vertical;
  if (platform === 'facebook') return v.horizontal;
  return v.square; // instagram and default
}

function detectMimeType(base64: string): string {
  const head = base64.slice(0, 12);
  if (head.startsWith('/9j/'))  return 'image/jpeg';
  if (head.startsWith('iVBOR')) return 'image/png';
  if (head.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

function placeholderUrl(businessName: string, tag: 'square' | 'vertical' | 'horizontal'): string {
  const sizes = { square: '1080x1080', vertical: '1080x1920', horizontal: '1920x1080' };
  return `https://placehold.co/${sizes[tag]}/6366f1/white?text=${encodeURIComponent(businessName)}`;
}

function buildPlaceholders(businessName: string, jobId: string): MediaGenerationVariations {
  return {
    square:     placeholderUrl(businessName, 'square'),
    vertical:   placeholderUrl(businessName, 'vertical'),
    horizontal: placeholderUrl(businessName, 'horizontal'),
    jobId,
  };
}
