/**
 * Content Generation Service — SANADDS
 *
 * Variation generation (all plans): 4 × 1080x1080 branded JPGs with different visual angles
 *
 * Publication after variation selection:
 *   Plan Basic ($97):        Use selected variation image directly
 *   Plan Professional ($197): Apply Ken Burns to selected image → MP4
 *   Plan Premium ($397):     4-clip reel from selected image → MP4
 */

import fs   from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../utils/logger';
import { generateVideo } from './veo.service';
import * as kie from './kie.service';
import { generateVideoPrompt } from './claude.service';

// Read API keys directly from process.env so this service works as a standalone script
// without requiring all other env vars (JWT_SECRET, ENCRYPTION_KEY, etc.)
const GEMINI_API_KEY_ENV      = () => process.env.GEMINI_API_KEY      ?? '';
const OPENAI_API_KEY_ENV      = () => process.env.OPENAI_API_KEY      ?? '';
const REPLICATE_API_TOKEN_ENV = () => process.env.REPLICATE_API_TOKEN ?? '';

const execFileAsync = promisify(execFile);

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

const BUNDLED_MUSIC = path.join(__dirname, '../assets/music/background.mp3');
const FONTS_DIR     = path.join(__dirname, '../assets/fonts');

// ── Design Decision types ──────────────────────────────────────────────────

export type FontStyle     = 'bold-sans' | 'elegant-serif' | 'modern-condensed' | 'strong-display';
export type TextPosition  = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-right' | 'center';
export type OverlayStyle  = 'dark-gradient' | 'light-gradient' | 'solid-overlay' | 'none';
export type VariationStyle = 'free' | 'minimalist' | 'bold' | 'elegant';

export interface DesignDecision {
  textPosition:   TextPosition;
  fontStyle:      FontStyle;
  textColor:      'white' | 'black' | 'brand-primary';
  overlayStyle:   OverlayStyle;
  overlayOpacity: number;
  fontSize:       'large' | 'medium' | 'small';
  reasoning:      string;
}

// Font → family name, fallback stack (no double quotes — XML attribute safe), asset file, weight
const FONT_CONFIG: Record<FontStyle, { family: string; fallback: string; file: string; weight: number }> = {
  'bold-sans':        { family: 'Oswald',          fallback: 'Impact, Arial, sans-serif',  file: 'oswald-bold.woff',            weight: 700 },
  'elegant-serif':    { family: 'Playfair Display', fallback: 'Georgia, serif',             file: 'playfair-display-bold.woff',  weight: 700 },
  'modern-condensed': { family: 'Roboto Condensed', fallback: 'Arial, sans-serif',          file: 'roboto-condensed-bold.woff',  weight: 700 },
  'strong-display':   { family: 'Bebas Neue',       fallback: 'Impact, Arial, sans-serif',  file: 'bebas-neue-regular.woff',     weight: 400 },
};

const VARIATION_STYLES: VariationStyle[] = ['free', 'minimalist', 'bold', 'elegant'];

// Lazy Anthropic client (only for design decisions — key read at call time)
let _designClient: Anthropic | null = null;
function getDesignClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_designClient) _designClient = new Anthropic({ apiKey: key });
  return _designClient;
}

// ── Public types ───────────────────────────────────────────────────────────

export interface ContentInput {
  businessName:    string;
  description?:    string;    // campaign-level business context (problem + differentiator)
  postFocus?:      string;    // what to highlight in this specific ad (post.post_focus)
  visualConcept?:  string;
  copyText:        string;
  primaryColor:    string;    // hex e.g. "#C9A96E"
  secondaryColor?: string;    // hex e.g. "#1A1A1A"
  logoBuffer?:     Buffer;    // PNG/SVG buffer for logo
  clientPhotos?:   string[];  // base64 JPEG/PNG for Gemini reference
  outputDir:       string;    // absolute path where files are saved
  campaignId?:     string;    // used in filenames/logs
  overlayLogo?:    boolean;   // add logo overlay to generated video
  overlayCopy?:    boolean;   // add copy text overlay to generated video
}

// ── Visual Variations (4 options for client to pick) ──────────────────────

const VARIATION_ANGLES = [
  'close-up intimate shot, detailed texture, warm foreground lighting',
  'wide environmental shot, full scene, spacious and airy composition',
  'lifestyle candid shot, natural authentic moment, human connection',
  'clean hero shot, minimal background, subject-focused showcase',
] as const;

const COMPOSITION_DIRECTIVES = [
  'COMPOSITION: centered subject, text prominently placed in upper or lower third',
  'COMPOSITION: subject positioned to one side, small elegant text on the opposite side',
  'COMPOSITION: extreme close-up of key detail or product, minimal text in corner',
  'COMPOSITION: wide establishing shot, text as overlay with semi-transparent scrim',
] as const;

export interface VisualVariationResult {
  path:                 string;
  type:                 'image';
  visualConceptVariant: string;
}

export async function generateVisualVariations(
  input:     ContentInput,
  outputDir: string,
): Promise<VisualVariationResult[]> {
  fs.mkdirSync(outputDir, { recursive: true });
  logger.info(`[ContentGen] Generating 4 AI-integrated-text variations for campaign ${input.campaignId ?? '?'}…`);

  const results: VisualVariationResult[] = [];
  for (let i = 0; i < 4; i++) {
    const varStyle  = VARIATION_STYLES[i];
    const angle     = VARIATION_ANGLES[i];
    const filePath  = path.join(outputDir, `variation_${i + 1}.jpg`);
    const varInput  = { ...input, visualConcept: `${input.visualConcept ?? 'professional scene'}. ${angle}` };

    logger.info(`[ContentGen] Variation ${i + 1}/4 — style: ${varStyle}`);
    const imgBuffer = await generateAdImageWithText(varInput, varStyle, null, i);
    await placeLogoAndSave(imgBuffer, input, filePath, 1080, 1080);

    results.push({ path: filePath, type: 'image' as const, visualConceptVariant: `ai-${varStyle}` });
  }

  logger.info('[ContentGen] All 4 variations generated.');
  return results;
}

// ── Visual Variations from client photos ──────────────────────────────────

export async function generateVisualVariationsFromPhotos(
  photoBuffers: Buffer[],
  input:        ContentInput,
  outputDir:    string,
  plan:         string,
): Promise<VisualVariationResult[]> {
  fs.mkdirSync(outputDir, { recursive: true });
  logger.info(`[ContentGen] Generating 4 photo variations (plan: ${plan}, photos: ${photoBuffers.length})…`);

  const results: VisualVariationResult[] = [];
  for (let i = 0; i < 4; i++) {
    const raw      = photoBuffers[i % photoBuffers.length];
    const filePath = path.join(outputDir, `variation_${i + 1}.jpg`);
    const varStyle = VARIATION_STYLES[i];

    // Premium plan: upscale before sending to the AI model
    let photoForAI: Buffer = raw;
    if (plan === 'premium') {
      const token = REPLICATE_API_TOKEN_ENV();
      if (token) {
        try {
          logger.info(`[ContentGen] Premium variation ${i + 1}: Real-ESRGAN upscale…`);
          photoForAI = await upscaleWithReplicate(raw, token);
        } catch (err) {
          logger.warn(`[ContentGen] Replicate failed: ${(err as Error).message} — using original`);
        }
      }
    } else if (plan === 'professional') {
      photoForAI = await sharp(raw).normalize().sharpen({ sigma: 1.5 }).jpeg({ quality: 92 }).toBuffer();
    }

    logger.info(`[ContentGen] Photo variation ${i + 1}/4 (${varStyle}) — sending to AI for text integration…`);
    const imgBuffer = await generateAdImageWithText(input, varStyle, photoForAI, i);
    await placeLogoAndSave(imgBuffer, input, filePath, 1080, 1080);

    results.push({ path: filePath, type: 'image' as const, visualConceptVariant: `client-photo-${varStyle}` });
  }

  logger.info('[ContentGen] All 4 photo variations generated.');
  return results;
}

// ── Plan Basic ─────────────────────────────────────────────────────────────

export async function generateBasicImages(
  input: ContentInput,
): Promise<{ feed: string; story: string }> {
  fs.mkdirSync(input.outputDir, { recursive: true });

  const feedPath  = path.join(input.outputDir, 'basic_feed.jpg');
  const storyPath = path.join(input.outputDir, 'basic_story.jpg');

  logger.info('[ContentGen] Generating Basic feed 1080x1080…');
  await composeBrandedImage(input, feedPath, 1080, 1080);

  logger.info('[ContentGen] Generating Basic story 1080x1920…');
  await composeBrandedImage(input, storyPath, 1080, 1920);

  return { feed: feedPath, story: storyPath };
}

// ── Plan Professional ──────────────────────────────────────────────────────
//
// Multi-image before/after flow (~12s):
//   Img 1 (4s) — "problema":  pain-point scene derived from business description
//   Img 2 (4s) — "solución":  aspirational result from visual_concept
//   Img 3 (4s) — closing card: copy + logo CTA
//   Transitions: crossfade (1→2), slideup (2→3)
//   Ken Burns zoom: 0.0022 — faster/more dynamic than Basic (0.0012)

function buildProblemVisualConcept(input: ContentInput): string {
  const desc = input.description ?? input.businessName;
  return (
    `BEFORE state — dramatic problem scene for ${desc}. ` +
    `Emotional close-up showing the client pain point: frustration, imperfect results, ` +
    `or the exact problem that ${input.businessName} solves. ` +
    `Moody, tense atmosphere, dim or harsh unflattering lighting. ` +
    `The viewer should immediately recognise the pain and feel the need for a solution.`
  );
}

function buildClosingBgVisualConcept(input: ContentInput): string {
  const desc = input.description ?? input.businessName;
  return (
    `Clean minimal premium background for ${desc}. ` +
    `Elegant studio aesthetic, soft warm bokeh, sophisticated and aspirational. ` +
    `Brand accent color ${input.primaryColor} subtly present. ` +
    `Lower two-thirds slightly uncluttered — this image will carry a text overlay call-to-action.`
  );
}

export async function generateProfessionalVideos(
  input: ContentInput,
): Promise<{ feed: string; story: string }> {
  fs.mkdirSync(input.outputDir, { recursive: true });
  const outputDir = input.outputDir;

  const feedOut  = path.join(outputDir, 'professional_feed.mp4');
  const storyOut = path.join(outputDir, 'professional_story.mp4');
  const audio    = path.join(outputDir, '_tmp_prof_audio.mp3');

  logger.info('[ContentGen] Professional — 3-image before/after flow (problem → solution → CTA)…');

  const problemInput = { ...input, visualConcept: buildProblemVisualConcept(input) };
  const closingInput = { ...input, visualConcept: buildClosingBgVisualConcept(input) };
  // solutionInput uses input as-is (visual_concept is the aspirational "after")

  // ── Feed (1080×1080) backgrounds ──────────────────────────────────────────
  logger.info('[ContentGen] Professional feed — bg 1/3 (problem)…');
  const bg1Feed = await getBackground(problemInput, 1080, 1080);
  logger.info('[ContentGen] Professional feed — bg 2/3 (solution)…');
  const bg2Feed = await getBackground(input, 1080, 1080);
  logger.info('[ContentGen] Professional feed — bg 3/3 (closing)…');
  const bg3Feed = await getBackground(closingInput, 1080, 1080);

  const img1FeedPath = path.join(outputDir, '_tmp_prof_f1.jpg');
  const img2FeedPath = path.join(outputDir, '_tmp_prof_f2.jpg');
  const img3FeedPath = path.join(outputDir, '_tmp_prof_f3.jpg');

  // Img 1 — raw problem visual, no text (drama first)
  await sharp(bg1Feed).resize(1080, 1080, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toFile(img1FeedPath);
  // Img 2 — solution visual, logo-only branding (aspirational)
  await placeLogoAndSave(bg2Feed, input, img2FeedPath, 1080, 1080);
  // Img 3 — closing card with full copy + logo CTA
  await composeClosingCard(bg3Feed, input, img3FeedPath, 1080, 1080);

  // ── Story (1080×1920) backgrounds ─────────────────────────────────────────
  logger.info('[ContentGen] Professional story — bg 1/3 (problem)…');
  const bg1Story = await getBackground(problemInput, 1080, 1920);
  logger.info('[ContentGen] Professional story — bg 2/3 (solution)…');
  const bg2Story = await getBackground(input, 1080, 1920);
  logger.info('[ContentGen] Professional story — bg 3/3 (closing)…');
  const bg3Story = await getBackground(closingInput, 1080, 1920);

  const img1StoryPath = path.join(outputDir, '_tmp_prof_s1.jpg');
  const img2StoryPath = path.join(outputDir, '_tmp_prof_s2.jpg');
  const img3StoryPath = path.join(outputDir, '_tmp_prof_s3.jpg');

  await sharp(bg1Story).resize(1080, 1920, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toFile(img1StoryPath);
  await placeLogoAndSave(bg2Story, input, img2StoryPath, 1080, 1920);
  await composeClosingCard(bg3Story, input, img3StoryPath, 1080, 1920);

  // ── Audio (14s covers 3×4s clips with 0.5s transitions) ───────────────────
  let audioReady = false;
  try {
    await prepareAudio(audio, 14);
    audioReady = true;
  } catch (err) {
    logger.warn('[ContentGen] Professional — audio failed (silent videos):', (err as Error).message);
  }

  const PROF_ZOOM  = 0.0022;  // faster than Basic (0.0012) for more energy
  const CLOSE_ZOOM = 0.0004;  // slow subtle drift for the closing card

  // ── Feed clips ────────────────────────────────────────────────────────────
  const clip1Feed = path.join(outputDir, '_tmp_prof_fc1.mp4');
  const clip2Feed = path.join(outputDir, '_tmp_prof_fc2.mp4');
  const clip3Feed = path.join(outputDir, '_tmp_prof_fc3.mp4');

  logger.info('[ContentGen] Professional feed — encoding Ken Burns clips…');
  await kenBurnsVideo(img1FeedPath, clip1Feed, 1080, 1080, 4, null, PROF_ZOOM);
  await kenBurnsVideo(img2FeedPath, clip2Feed, 1080, 1080, 4, null, PROF_ZOOM * 0.8);
  await kenBurnsVideo(img3FeedPath, clip3Feed, 1080, 1080, 4, null, CLOSE_ZOOM);

  logger.info('[ContentGen] Professional feed — concat with xfade transitions…');
  await concatWithXfade([clip1Feed, clip2Feed, clip3Feed], audioReady ? audio : null, feedOut, outputDir);

  // ── Story clips ───────────────────────────────────────────────────────────
  const clip1Story = path.join(outputDir, '_tmp_prof_sc1.mp4');
  const clip2Story = path.join(outputDir, '_tmp_prof_sc2.mp4');
  const clip3Story = path.join(outputDir, '_tmp_prof_sc3.mp4');

  logger.info('[ContentGen] Professional story — encoding Ken Burns clips…');
  await kenBurnsVideo(img1StoryPath, clip1Story, 1080, 1920, 4, null, PROF_ZOOM);
  await kenBurnsVideo(img2StoryPath, clip2Story, 1080, 1920, 4, null, PROF_ZOOM * 0.8);
  await kenBurnsVideo(img3StoryPath, clip3Story, 1080, 1920, 4, null, CLOSE_ZOOM);

  logger.info('[ContentGen] Professional story — concat with xfade transitions…');
  await concatWithXfade([clip1Story, clip2Story, clip3Story], audioReady ? audio : null, storyOut, outputDir);

  logger.info('[ContentGen] Professional videos complete (~12s each, before/after flow).');
  return { feed: feedOut, story: storyOut };
}

// ── Plan Premium ───────────────────────────────────────────────────────────
//
// Flow:
//   Clip 1 (8s) — Veo 2 cinematic scene from visual_concept
//                 Fallback: Ken Burns from branded image
//   Clip 2 (8s) — Client photo (or Gemini image) with copy+logo, Ken Burns
//   FFmpeg concat + background music → ~16s MP4

export async function generatePremiumReel(
  input: ContentInput,
): Promise<{ reel: string }> {
  fs.mkdirSync(input.outputDir, { recursive: true });

  const outputDir      = input.outputDir;
  const reelOut        = path.join(outputDir, 'premium_reel.mp4');
  const audio          = path.join(outputDir, '_tmp_reel_audio.mp3');
  const clip2ImgPath   = path.join(outputDir, '_tmp_reel_clip2.jpg');
  const closingImgPath = path.join(outputDir, '_tmp_reel_closing.jpg');

  // ── Clip 2 (8s): Gemini clean image — same visual_concept as Veo 2 clip 1 ─
  // No copy or logo here; branding appears only in the closing card.
  logger.info('[ContentGen] Reel — clip 2: Gemini clean image (visual concept)…');
  const bgBuffer = await generateCleanBrandImage(input, 1080, 1920);
  fs.writeFileSync(clip2ImgPath, bgBuffer);
  const clip2 = path.join(outputDir, '_tmp_reel_clip2.mp4');
  await kenBurnsVideo(clip2ImgPath, clip2, 1080, 1920, 8, null, 0.00135);

  // ── Clip 1 (8s): Grok (KIE.ai) → Kling 3.0 → Veo 2 → Ken Burns fallback ──
  let clip1: string;
  logger.info('[ContentGen] Reel — clip 1: Grok (KIE.ai)…');
  try {
    const grokPath = await generateGrokClip(input, outputDir);
    if (!grokPath) throw new Error('Grok devolvió null');
    clip1 = grokPath;
    logger.info('[ContentGen] Reel — clip 1: Grok success');
  } catch (grokErr) {
    logger.warn(`[ContentGen] Reel — Grok failed: ${(grokErr as Error).message} — trying Kling 3.0…`);
    try {
      const klingPath = await generateKling3Video(clip2ImgPath, input, outputDir);
      if (!klingPath) throw new Error('Kling 3.0 devolvió null');
      clip1 = klingPath;
      logger.info('[ContentGen] Reel — clip 1: Kling 3.0 success');
    } catch (klingErr) {
      logger.warn(`[ContentGen] Reel — Kling 3.0 failed: ${(klingErr as Error).message} — trying Veo 2…`);
      try {
        const veoPath = await generateVeoClip(input, outputDir);
        if (!veoPath) throw new Error('Veo 2 devolvió null (sin key o API caída)');
        clip1 = veoPath;
        logger.info('[ContentGen] Reel — clip 1: Veo 2 success');
      } catch (veoErr) {
        logger.warn(`[ContentGen] Reel — Veo 2 failed: ${(veoErr as Error).message} — Ken Burns fallback`);
        clip1 = path.join(outputDir, '_tmp_reel_clip1_kb.mp4');
        await kenBurnsVideo(clip2ImgPath, clip1, 1080, 1920, 8, null, 0.00168);
      }
    }
  }

  // ── Closing card (3s): dedicated 1080×1920 layout ────────────────────────
  logger.info('[ContentGen] Reel — closing card: copy + logo…');
  await composeClosingCard(bgBuffer, input, closingImgPath, 1080, 1920);
  const closingClip = path.join(outputDir, '_tmp_reel_closing.mp4');
  await kenBurnsVideo(closingImgPath, closingClip, 1080, 1920, 3, null, 0.0003);

  // ── Audio ─────────────────────────────────────────────────────────────────
  let audioReady = false;
  try {
    await prepareAudio(audio, 22);
    audioReady = true;
  } catch (err) {
    logger.warn('[ContentGen] Reel — audio failed:', (err as Error).message);
  }

  // ── Concat clip 1 (8s) + clip 2 (8s) + closing (3s) = ~19s ───────────────
  logger.info('[ContentGen] Reel — concatenating 3 clips (8+8+3s)…');
  await concatWithAudio([clip1, clip2, closingClip], audioReady ? audio : null, reelOut, outputDir);

  logger.info('[ContentGen] Premium reel complete (~19s).');
  return { reel: reelOut };
}

// ── Professional video from a pre-generated image ─────────────────────────

export async function generateProfessionalVideosFromImage(
  imagePath: string,
  outputDir: string,
  input?:    ContentInput,
): Promise<{ feed: string; story: string }> {
  fs.mkdirSync(outputDir, { recursive: true });

  const feedOut  = path.join(outputDir, 'professional_feed.mp4');
  const storyOut = path.join(outputDir, 'professional_story.mp4');

  // ── AI video chain: Hailuo (120s) → Kling 3.0 → Ken Burns fallback ─────────
  if (input?.visualConcept && input) {
    // 1. Hailuo 2.3 via KIE.ai (image → video, 120s timeout)
    logger.info('[ContentGen] Professional — Hailuo 2.3 (KIE.ai)…');
    try {
      const hailuoResult = await generateHailuoClip(imagePath, input, outputDir);
      if (hailuoResult) {
        logger.info('[ContentGen] Professional — Hailuo 2.3 success');
        return hailuoResult;
      }
    } catch (hailuoErr) {
      logger.warn(`[ContentGen] Professional — Hailuo failed: ${(hailuoErr as Error).message} — trying Kling 3.0…`);
    }

    // 2. Kling 3.0 via Higgsfield CLI (consistent 60-90s)
    logger.info('[ContentGen] Professional — Kling 3.0…');
    try {
      const klingPath = await generateKling3Video(imagePath, input, outputDir);
      if (klingPath) {
        logger.info('[ContentGen] Professional — Kling 3.0 success');
        return await buildStoryWithClosingCard(klingPath, imagePath, input, outputDir, 'kling', feedOut, storyOut);
      }
    } catch (klingErr) {
      logger.warn(`[ContentGen] Professional — Kling 3.0 failed: ${(klingErr as Error).message} — Ken Burns fallback`);
    }
  }

  // 3. Ken Burns (local) fallback
  const safeInputJpeg = path.join(outputDir, '_tmp_prof_input.jpg');
  const storyImg      = path.join(outputDir, '_tmp_story_from_img.jpg');
  const audio         = path.join(outputDir, '_tmp_audio.mp3');

  // Convert to JPEG buffer before any further Sharp calls — prevents
  // "unsupported image format" when imagePath is WebP or a non-JPEG format.
  const inputJpegBuf = await sharp(imagePath).jpeg().toBuffer();
  fs.writeFileSync(safeInputJpeg, inputJpegBuf);

  await sharp(inputJpegBuf)
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .toFile(storyImg);

  let audioReady = false;
  try {
    await prepareAudio(audio, 20);
    audioReady = true;
  } catch (err) {
    logger.warn('[ContentGen] Audio failed (silent videos):', (err as Error).message);
  }

  logger.info('[ContentGen] Professional feed Ken Burns…');
  await kenBurnsVideo(safeInputJpeg, feedOut, 1080, 1080, 15, audioReady ? audio : null);

  logger.info('[ContentGen] Professional story Ken Burns…');
  await kenBurnsVideo(storyImg, storyOut, 1080, 1920, 20, audioReady ? audio : null);

  return { feed: feedOut, story: storyOut };
}

// ── Premium reel from a pre-selected image ────────────────────────────────
//
// imagePath: the branded thumbnail the user selected (already has copy+logo).
// input:     optional ContentInput — if provided with visualConcept, enables Veo 2 clip 1.
//
// Clip 1 (8s): Veo 2 scene  →  fallback: Ken Burns from branded image
// Clip 2 (8s): Selected branded image + Ken Burns
// Total: ~16s MP4

const REEL_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes hard ceiling

export async function generatePremiumReelFromImage(
  imagePath: string,
  outputDir: string,
  input?:    ContentInput,
): Promise<{ reel: string }> {
  const timeoutGuard = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('[Timeout] generatePremiumReelFromImage exceeded 8 minutes — process cancelled')),
      REEL_TIMEOUT_MS,
    ),
  );
  return Promise.race([_runPremiumReelFromImage(imagePath, outputDir, input), timeoutGuard]);
}

async function _runPremiumReelFromImage(
  imagePath: string,
  outputDir: string,
  input?:    ContentInput,
): Promise<{ reel: string }> {
  fs.mkdirSync(outputDir, { recursive: true });

  logger.info(`[ContentGen] generatePremiumReelFromImage — visualConcept: "${input?.visualConcept?.slice(0, 300) ?? '*** EMPTY/UNDEFINED ***'}"`);
  logger.info(`[ContentGen] generatePremiumReelFromImage — businessName: "${input?.businessName ?? '*** EMPTY ***'}"`);
  logger.info(`[ContentGen] generatePremiumReelFromImage — copyText: "${input?.copyText?.slice(0, 120) ?? '*** EMPTY ***'}"`);

  const reelOut        = path.join(outputDir, 'premium_reel.mp4');
  const audio          = path.join(outputDir, '_tmp_reel_audio.mp3');
  const clip2ImgPath   = path.join(outputDir, '_tmp_reel_clip2.jpg');
  const closingImgPath = path.join(outputDir, '_tmp_reel_closing.jpg');

  // ── Clip 2 (8s): Gemini clean image — same visual_concept as Veo 2 clip 1 ─
  // No copy or logo — branding appears only in the closing card.
  // Falls back to the selected image if Gemini is unavailable.
  logger.info('[ContentGen] Reel — clip 2: Gemini clean image (visual concept)…');
  let clip2GenOk = false;
  if (input?.visualConcept) {
    try {
      const bgBuffer = await generateCleanBrandImage(input, 1080, 1920);
      fs.writeFileSync(clip2ImgPath, bgBuffer);
      clip2GenOk = true;
    } catch (err) {
      logger.warn(`[ContentGen] Reel — Gemini clip 2 failed, using selected image: ${(err as Error).message}`);
    }
  }
  if (!clip2GenOk) {
    await sharp(imagePath)
      .resize(1080, 1920, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toFile(clip2ImgPath);
  }
  const clip2 = path.join(outputDir, '_tmp_reel_clip2.mp4');
  await kenBurnsVideo(clip2ImgPath, clip2, 1080, 1920, 8, null, 0.00135);

  // ── Clip 1 (8s): Grok (KIE.ai) → Kling 3.0 → Veo 2 → Ken Burns fallback ──
  let clip1: string;
  if (input?.visualConcept) {
    // 1. Grok via KIE.ai
    logger.info('[ContentGen] Reel — clip 1: Grok (KIE.ai)…');
    try {
      const grokPath = await generateGrokClip(input, outputDir);
      if (!grokPath) throw new Error('Grok returned null');
      clip1 = grokPath;
      logger.info('[ContentGen] Reel — clip 1: Grok success');
    } catch (grokErr) {
      logger.warn(`[ContentGen] Reel — Grok failed: ${(grokErr as Error).message} — trying Kling 3.0…`);
      // 2. Kling 3.0
      try {
        const klingPath = await generateKling3Video(clip2ImgPath, input, outputDir);
        if (!klingPath) throw new Error('Kling 3.0 returned null');
        clip1 = klingPath;
        logger.info('[ContentGen] Reel — clip 1: Kling 3.0 success');
      } catch (klingErr) {
        logger.warn(`[ContentGen] Reel — Kling 3.0 failed: ${(klingErr as Error).message} — trying Veo 2…`);
        // 3. Veo 2
        try {
          const veoPath = await generateVeoClip(input, outputDir);
          if (!veoPath) throw new Error('Veo 2 returned null');
          clip1 = veoPath;
          logger.info('[ContentGen] Reel — clip 1: Veo 2 success');
        } catch (veoErr) {
          // 4. Ken Burns fallback
          logger.warn(`[ContentGen] Reel — Veo 2 failed: ${(veoErr as Error).message} — Ken Burns fallback`);
          clip1 = path.join(outputDir, '_tmp_reel_clip1_kb.mp4');
          await kenBurnsVideo(clip2ImgPath, clip1, 1080, 1920, 8, null, 0.00168);
        }
      }
    }
  } else {
    logger.info('[ContentGen] Reel — clip 1: Ken Burns (no visualConcept)');
    clip1 = path.join(outputDir, '_tmp_reel_clip1_kb.mp4');
    await kenBurnsVideo(clip2ImgPath, clip1, 1080, 1920, 8, null, 0.00168);
  }

  // ── Closing card (3s): fresh text on the clean 1080×1920 background ────────
  // clip2ImgPath is always a proper 1080×1920 image (Gemini scene or resized
  // fallback). We use it instead of the 1080×1080 selected variation so that
  // cover-fitting never crops baked-in text off the sides.
  logger.info('[ContentGen] Reel — closing card: copy + logo (1080×1920)…');
  {
    const bgBuf = await sharp(clip2ImgPath).jpeg({ quality: 92 }).toBuffer();
    if (input) {
      await composeClosingCard(bgBuf, input, closingImgPath, 1080, 1920);
    } else {
      await sharp(bgBuf).toFile(closingImgPath);
    }
  }
  const closingClip = path.join(outputDir, '_tmp_reel_closing.mp4');
  await kenBurnsVideo(closingImgPath, closingClip, 1080, 1920, 3, null, 0.0003);

  // ── Audio ─────────────────────────────────────────────────────────────────
  let audioReady = false;
  try {
    await prepareAudio(audio, 22);
    audioReady = true;
  } catch (err) {
    logger.warn('[ContentGen] Reel — audio failed:', (err as Error).message);
  }

  // ── Concat clip 1 (8s) + clip 2 (8s) + closing (3s) = ~19s ───────────────
  logger.info('[ContentGen] Reel — concatenating 3 clips (8+8+3s)…');
  await concatWithAudio([clip1, clip2, closingClip], audioReady ? audio : null, reelOut, outputDir);

  logger.info('[ContentGen] Premium reel complete (~19s).');
  return { reel: reelOut };
}

// ── Plan Premium: real video from start to finish (no Ken Burns / closing card) ─
//
// 3 clips (~7s each), all AI-generated, anchored to the SAME base image/scene
// for continuity, each with a different camera movement (push-in / static
// detail / pull-back), joined with a soft crossfade. Same per-clip fallback
// chain as the mixed reel: Grok (KIE.ai) → Kling 3.0 → Veo 2 → Ken Burns as
// last resort. No closing card — logo/copy are applied afterward via
// applyVideoOverlays.

const VIDEO_TIMEOUT_MS          = 8 * 60 * 1000; // 8 minutes hard ceiling, same as reel
const VIDEO_CLIP_DURATION       = 7;              // seconds per clip — must be uniform for xfade offset math
const VIDEO_TRANSITION_DURATION = 0.5;             // seconds

const CAMERA_DIRECTIONS = [
  'CAMERA DIRECTION: slow, smooth push-in (dolly forward) toward the main subject, gradually revealing detail. Steady, cinematic pace, no cuts.',
  'CAMERA DIRECTION: static or nearly static close-up detail shot, minimal camera movement, sharp focus on texture and detail.',
  'CAMERA DIRECTION: slow pull-back (dolly out) revealing the full scene and surrounding context. Steady, cinematic pace, no cuts.',
];

export async function generatePremiumVideoFromImage(
  imagePath: string,
  outputDir: string,
  input?:    ContentInput,
): Promise<{ video: string }> {
  const timeoutGuard = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('[Timeout] generatePremiumVideoFromImage exceeded 8 minutes — process cancelled')),
      VIDEO_TIMEOUT_MS,
    ),
  );
  return Promise.race([_runPremiumVideoFromImage(imagePath, outputDir, input), timeoutGuard]);
}

async function _runPremiumVideoFromImage(
  imagePath: string,
  outputDir: string,
  input?:    ContentInput,
): Promise<{ video: string }> {
  fs.mkdirSync(outputDir, { recursive: true });

  logger.info(`[ContentGen] generatePremiumVideoFromImage — visualConcept: "${input?.visualConcept?.slice(0, 300) ?? '*** EMPTY/UNDEFINED ***'}"`);
  logger.info(`[ContentGen] generatePremiumVideoFromImage — businessName: "${input?.businessName ?? '*** EMPTY ***'}"`);
  logger.info(`[ContentGen] generatePremiumVideoFromImage — copyText: "${input?.copyText?.slice(0, 120) ?? '*** EMPTY ***'}"`);

  const videoOut    = path.join(outputDir, 'premium_video.mp4');
  const audio       = path.join(outputDir, '_tmp_video_audio.mp3');
  const baseImgPath = path.join(outputDir, '_tmp_video_base.jpg');

  // ── Single clean base image, reused across all 3 clips for scene continuity ─
  logger.info('[ContentGen] Video — base image: Gemini clean scene…');
  let baseImgReady = false;
  if (input?.visualConcept) {
    try {
      const bgBuffer = await generateCleanBrandImage(input, 1080, 1920);
      fs.writeFileSync(baseImgPath, bgBuffer);
      baseImgReady = true;
    } catch (err) {
      logger.warn(`[ContentGen] Video — base image Gemini failed, using selected image: ${(err as Error).message}`);
    }
  }
  if (!baseImgReady) {
    await sharp(imagePath)
      .resize(1080, 1920, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toFile(baseImgPath);
  }

  // ── 3 clips (~7s each), same base image/scene, distinct camera movement ────
  const clips: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (input?.visualConcept) {
      const clipInput: ContentInput = {
        ...input,
        visualConcept: `${input.visualConcept}. ${CAMERA_DIRECTIONS[i]}`,
      };
      logger.info(`[ContentGen] Video — clip ${i + 1}/3: Grok → Kling 3.0 → Veo 2 → Ken Burns…`);
      clips.push(await generatePremiumVideoClip(clipInput, baseImgPath, outputDir, i, VIDEO_CLIP_DURATION));
    } else {
      logger.info(`[ContentGen] Video — clip ${i + 1}/3: Ken Burns (no visualConcept)`);
      const kb = path.join(outputDir, `_tmp_video_clip${i + 1}_kb.mp4`);
      await kenBurnsVideo(baseImgPath, kb, 1080, 1920, VIDEO_CLIP_DURATION, null, 0.0015 + i * 0.0003);
      clips.push(kb);
    }
  }

  // ── Audio ─────────────────────────────────────────────────────────────────
  const totalDuration = clips.length * VIDEO_CLIP_DURATION - (clips.length - 1) * VIDEO_TRANSITION_DURATION;
  let audioReady = false;
  try {
    await prepareAudio(audio, totalDuration);
    audioReady = true;
  } catch (err) {
    logger.warn('[ContentGen] Video — audio failed:', (err as Error).message);
  }

  // ── Concat 3 clips with crossfade transitions ───────────────────────────────
  logger.info('[ContentGen] Video — concatenating 3 clips with xfade…');
  await concatWithXfade(
    clips,
    audioReady ? audio : null,
    videoOut,
    outputDir,
    VIDEO_CLIP_DURATION,
    VIDEO_TRANSITION_DURATION,
    ['fade', 'slideup'],
  );

  logger.info(`[ContentGen] Premium video complete (~${totalDuration.toFixed(1)}s).`);
  return { video: videoOut };
}

// ── Core: Composed branded image ───────────────────────────────────────────

async function composeBrandedImage(
  input:      ContentInput,
  outputPath: string,
  width:      number,
  height:     number,
  design?:    DesignDecision,
): Promise<void> {
  const bgBuffer = await getBackground(input, width, height);

  const overlayBuffer = design
    ? buildOverlaySVGWithDesign(width, height, input, design)
    : buildOverlaySVG(width, height, input);

  const composites: sharp.OverlayOptions[] = [
    { input: overlayBuffer, top: 0, left: 0 },
  ];

  if (input.logoBuffer) {
    const logoMaxW    = Math.round(width * 0.20);
    const logoPad     = Math.round(width * 0.04);
    const resizedLogo = await sharp(input.logoBuffer)
      .resize(logoMaxW, undefined, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    const logoW    = logoMeta.width  ?? logoMaxW;
    composites.push({
      input: resizedLogo,
      top:   logoPad,
      left:  width - logoW - logoPad,
    });
  }

  await sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .composite(composites)
    .toFile(outputPath);
}

// ── Branded image from a pre-provided background buffer ───────────────────

async function composeBrandedImageFromBuffer(
  bgBuffer:   Buffer,
  input:      ContentInput,
  outputPath: string,
  width:      number,
  height:     number,
  design?:    DesignDecision,
): Promise<void> {
  const overlayBuffer = design
    ? buildOverlaySVGWithDesign(width, height, input, design)
    : buildOverlaySVG(width, height, input);

  const composites: sharp.OverlayOptions[] = [{ input: overlayBuffer, top: 0, left: 0 }];

  if (input.logoBuffer) {
    const logoMaxW    = Math.round(width * 0.20);
    const logoPad     = Math.round(width * 0.04);
    const resizedLogo = await sharp(input.logoBuffer)
      .resize(logoMaxW, undefined, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha().png().toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    composites.push({ input: resizedLogo, top: logoPad, left: width - (logoMeta.width ?? logoMaxW) - logoPad });
  }

  await sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .composite(composites)
    .toFile(outputPath);
}

// ── Replicate Real-ESRGAN photo upscaler ──────────────────────────────────

async function upscaleWithReplicate(photoBuffer: Buffer, token: string): Promise<Buffer> {
  const dataUrl = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;

  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
    body: JSON.stringify({
      version: '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
      input:   { image: dataUrl, scale: 4 },
    }),
  });
  const prediction = await createRes.json() as { id: string; error?: string };
  if (!createRes.ok) throw new Error(prediction.error ?? `Replicate HTTP ${createRes.status}`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Token ${token}` },
    });
    const poll = await pollRes.json() as { status: string; output?: string; error?: string };
    if (poll.status === 'succeeded' && poll.output) {
      const imgRes = await fetch(poll.output);
      if (!imgRes.ok) throw new Error(`Replicate download failed: HTTP ${imgRes.status}`);
      return Buffer.from(await imgRes.arrayBuffer());
    }
    if (poll.status === 'failed') throw new Error(poll.error ?? 'Replicate prediction failed');
  }
  throw new Error('Replicate prediction timed out after 60s');
}

// ── AI-Integrated Text Generation ─────────────────────────────────────────
// DALL-E 3 / Gemini generate the complete ad image with text built in.
// Sharp is only used afterward to place the logo and encode the final JPEG.

const STYLE_DESCRIPTIONS: Record<VariationStyle, string> = {
  free:       'creative professional composition — dynamic layout, typography as a design element, unexpected but intentional',
  minimalist: 'Scandinavian minimalist aesthetic — generous white space, restrained typography, premium silence',
  bold:       'high-impact editorial poster — large dominant typography, strong contrast, instantly readable at a glance',
  elegant:    'luxury brand aesthetic — refined serif typography, understated sophistication, premium editorial feel',
};

function buildAdPromptWithText(
  input:          ContentInput,
  style:          VariationStyle,
  hasPhoto:       boolean,
  variationIndex: number = 0,
): string {
  const styleDesc   = STYLE_DESCRIPTIONS[style];
  const composition = COMPOSITION_DIRECTIVES[variationIndex] ?? COMPOSITION_DIRECTIVES[0];
  const seed        = Date.now();

  const copyLines = input.copyText.split(/[.\n]/).map(s => s.trim()).filter(Boolean);
  const headline  = copyLines[0] ?? input.copyText;
  const subtitle  = copyLines.slice(1).join('. ');

  const textBlock = subtitle
    ? `PRIMARY TEXT (headline, large): "${headline}"\nSECONDARY TEXT (smaller): "${subtitle}"`
    : `ADVERTISING TEXT: "${headline}"`;

  const brandBlock = `BRAND NAME (small, secondary element): ${input.businessName}
BRAND ACCENT COLOR: ${input.primaryColor}`;

  const textRules = `
TEXT REQUIREMENTS (critical):
- Every word must appear EXACTLY as written above — no paraphrasing, no translation
- Use typographic treatments that make text feel designed-in: frosted panels, gradient scrims, cut-out letters, embossed effects, or floating text with soft shadow
- Text must be clearly legible, high contrast with background
- Avoid raw white text pasted on top — text must feel integrated into the composition`;

  if (hasPhoto) {
    return `Create a premium social media advertising image (1:1 square format, 1080×1080px).

TASK: Transform the provided photograph into a polished social media advertisement.
DESIGN STYLE: ${styleDesc}
${composition}
UNIQUENESS: Create a completely unique composition, different from any previous generation. Seed: ${seed}

${textBlock}
${brandBlock}${textRules}

VISUAL REQUIREMENTS:
- The provided photo is the main visual — keep the subject prominent
- Enhance composition with professional color grading if needed
- Typography and layout must feel like a graphic designer built this, not a filter app
- Brand accent color (${input.primaryColor}) appears as a design accent (line, bar, highlight, or button)
- Output must look like a premium Instagram or Facebook ad`;
  }

  const scene = input.visualConcept ?? `professional scene for ${input.businessName}`;
  return `Create a premium social media advertising image (1:1 square format, 1080×1080px).

BUSINESS: ${input.description ?? input.businessName}
VISUAL SCENE: ${scene}
DESIGN STYLE: ${styleDesc}
${composition}
UNIQUENESS: Create a completely unique composition, different from any previous generation. Seed: ${seed}

${textBlock}
${brandBlock}${textRules}

VISUAL REQUIREMENTS:
- Generate a realistic, well-lit, editorial-quality photograph for the scene above
- Typography must be INTEGRATED into the composition, not overlaid afterward
- Examples of good text integration: neon sign in scene, text carved on surface, floating text with matching aesthetic, overlaid panel in brand style
- Brand accent color (${input.primaryColor}) woven into the design
- Output must look like a premium Instagram or Facebook ad created by a professional design agency`;
}

async function callGeminiWithText(
  input:          ContentInput,
  apiKey:         string,
  style:          VariationStyle,
  photoBuffer:    Buffer | null,
  variationIndex: number = 0,
): Promise<Buffer> {
  const hasPhoto = !!photoBuffer;
  const prompt   = buildAdPromptWithText(input, style, hasPhoto, variationIndex);

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];

  if (photoBuffer) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: photoBuffer.toString('base64') } });
  }

  const res = await fetch(GEMINI_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body:    JSON.stringify({
      contents:         [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }>;
    error?: { message: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Gemini HTTP ${res.status}`);

  const imgPart = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!imgPart?.inlineData?.data) throw new Error('Gemini returned no image data');
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

async function callDallEWithText(
  input:          ContentInput,
  apiKey:         string,
  style:          VariationStyle,
  hasPhoto:       boolean = false,
  variationIndex: number  = 0,
): Promise<Buffer> {
  const prompt = buildAdPromptWithText(input, style, hasPhoto, variationIndex);

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({
      model:   'dall-e-3',
      prompt,
      size:    '1024x1024',
      quality: 'hd',
      n:       1,
    }),
  });
  const json = await res.json() as { data?: Array<{ url: string }>; error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `DALL-E-3 HTTP ${res.status}`);

  const url = json.data?.[0]?.url;
  if (!url) throw new Error('DALL-E-3 returned no image URL');
  const img = await fetch(url);
  if (!img.ok) throw new Error(`DALL-E-3 download failed: HTTP ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

async function generateAdImageWithText(
  input:          ContentInput,
  style:          VariationStyle,
  photoBuffer:    Buffer | null,
  variationIndex: number = 0,
): Promise<Buffer> {
  const geminiKey = GEMINI_API_KEY_ENV();
  if (geminiKey) {
    try {
      return await callGeminiWithText(input, geminiKey, style, photoBuffer, variationIndex);
    } catch (err) {
      logger.warn(`[ContentGen] Gemini+text failed (${style}): ${(err as Error).message}`);
    }
  }

  const openaiKey = OPENAI_API_KEY_ENV();
  if (openaiKey) {
    try {
      return await callDallEWithText(input, openaiKey, style, !!photoBuffer, variationIndex);
    } catch (err) {
      logger.warn(`[ContentGen] DALL-E+text failed (${style}): ${(err as Error).message}`);
    }
  }

  // Last resort: synthetic background + Sharp design overlay
  logger.warn(`[ContentGen] All AI text-generation APIs failed for style "${style}" — using Sharp overlay fallback`);
  const base = photoBuffer
    ? await sharp(photoBuffer).resize(1080, 1080, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toBuffer()
    : await syntheticBg(1080, 1080, input.primaryColor ?? '', input.secondaryColor);
  const design  = fallbackDesign(style);
  const overlay = buildOverlaySVGWithDesign(1080, 1080, input, design);
  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function placeLogoAndSave(
  imgBuffer:  Buffer,
  input:      ContentInput,
  outputPath: string,
  width:      number,
  height:     number,
): Promise<void> {
  const composites: sharp.OverlayOptions[] = [];

  if (input.logoBuffer) {
    const logoMaxW    = Math.round(width * 0.18);
    const logoPad     = Math.round(width * 0.04);
    const resizedLogo = await sharp(input.logoBuffer)
      .resize(logoMaxW, undefined, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    composites.push({
      input: resizedLogo,
      top:   logoPad,
      left:  width - (logoMeta.width ?? logoMaxW) - logoPad,
    });
  }

  await sharp(imgBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .composite(composites)
    .toFile(outputPath);
}

// ── Background: Gemini or synthetic ───────────────────────────────────────

async function getBackground(
  input:  ContentInput,
  width:  number,
  height: number,
  allowSyntheticFallback: boolean = true,
): Promise<Buffer> {
  const geminiKey = GEMINI_API_KEY_ENV();
  if (geminiKey) {
    try {
      return await callGemini(input, width, height, geminiKey);
    } catch (err) {
      logger.warn(`[ContentGen] Gemini failed, trying DALL-E 3: ${(err as Error).message}`);
    }
  } else {
    logger.warn('[ContentGen] GEMINI_API_KEY not set — skipping Gemini');
  }

  const openaiKey = OPENAI_API_KEY_ENV();
  if (openaiKey) {
    try {
      return await callDallE(input, width, height, openaiKey);
    } catch (err) {
      logger.warn(`[ContentGen] DALL-E failed, using synthetic background: ${(err as Error).message}`);
    }
  } else {
    logger.warn('[ContentGen] OPENAI_API_KEY not set — skipping DALL-E');
  }

  if (!allowSyntheticFallback) {
    throw new Error('All AI image providers failed (synthetic fallback disabled for this caller)');
  }

  logger.warn('[ContentGen] All AI providers failed — synthetic background');
  return syntheticBg(width, height, input.primaryColor, input.secondaryColor);
}

// Clean (no-text, no-logo) regeneration of the same visual_concept scene, sized
// and cropped to the target dimensions. Shared by Premium (reel clip 2, closing
// card bg) and Professional (Hailuo source frame) — anything that must NOT show
// AI-baked copy text should composite on top of this instead of a branded variation.
//
// allowSyntheticFallback=false makes this throw instead of silently returning a
// flat gradient when Gemini/DALL-E both fail — used by callers (Hailuo) that
// have a better fallback of their own (the original branded image) and would
// rather use that than animate an unbranded gradient.
async function generateCleanBrandImage(
  input:  ContentInput,
  width:  number,
  height: number,
  allowSyntheticFallback: boolean = true,
): Promise<Buffer> {
  const bgBuffer = await getBackground(input, width, height, allowSyntheticFallback);
  return sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function callGemini(
  input:  ContentInput,
  width:  number,
  height: number,
  apiKey: string,
): Promise<Buffer> {
  const aspectLabel = width === height ? '1:1 square 1080×1080'
    : height > width ? '9:16 vertical 1080×1920'
    : '16:9 horizontal 1920×1080';

  const scene           = input.visualConcept ?? 'modern professional scene, warm natural lighting';
  const campaignContext = input.description   ?? '';

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{
    text: `Generate a REALISTIC PROFESSIONAL PHOTOGRAPH for a social media advertisement.

BRAND: ${input.businessName}${campaignContext ? ` — Campaign: ${campaignContext}` : ''}

VISUAL SCENE TO PHOTOGRAPH — this is the PRIMARY directive, follow it exactly:
${scene}

FORMAT: ${aspectLabel} photograph.

PHOTOGRAPHY REQUIREMENTS:
- Photograph EXACTLY the scene described above — do not substitute with a generic scene
- Realistic editorial photo, NOT abstract, NOT dark, NOT a digital illustration
- Well-lit scene with warm, inviting natural or studio lighting
- Bright and vibrant — this is for Instagram advertising, must look attractive
- Sharp main subject with soft background for depth
- Editorial magazine quality, warm color palette, rich tones

ABSOLUTE PROHIBITIONS — the image must NOT contain ANY of these:
- Text, words, letters, numbers, or characters of any kind
- Logos, watermarks, or brand marks
- Dark abstract backgrounds or geometric shapes
- Digital overlays or gradients

COMPOSITION: Leave the bottom 30% of the image slightly uncluttered (will be used for text overlay).

Output: ONE beautiful, realistic photograph that captures exactly the scene described above.`,
  }];

  for (const photo of (input.clientPhotos ?? []).slice(0, 2)) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: photo } });
  }

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });
  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }>;
    error?: { message: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Gemini HTTP ${res.status}`);

  const imgPart = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!imgPart?.inlineData?.data) throw new Error('Gemini returned no image data');

  return Buffer.from(imgPart.inlineData.data, 'base64');
}

async function callDallE(
  input:  ContentInput,
  width:  number,
  height: number,
  apiKey: string,
): Promise<Buffer> {
  // dall-e-3 supports portrait sizes; dall-e-2 only supports square
  const tryDalle3 = async (): Promise<Buffer> => {
    const size: '1024x1024' | '1024x1792' | '1792x1024' =
      width === height ? '1024x1024'
      : height > width ? '1024x1792'
      :                  '1792x1024';

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body:    JSON.stringify({ model: 'dall-e-3', prompt: buildDallEPrompt(input), size, quality: 'standard', n: 1 }),
    });
    const json = await res.json() as { data?: Array<{ url: string }>; error?: { message: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `DALL-E-3 HTTP ${res.status}`);
    const url = json.data?.[0]?.url;
    if (!url) throw new Error('DALL-E-3 returned no image URL');
    logger.info('[ContentGen] DALL-E 3 image generated, downloading…');
    const img = await fetch(url);
    if (!img.ok) throw new Error(`DALL-E-3 download failed: HTTP ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  };

  const tryDalle2 = async (): Promise<Buffer> => {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body:    JSON.stringify({ model: 'dall-e-2', prompt: buildDallEPrompt(input), size: '1024x1024', n: 1 }),
    });
    const json = await res.json() as { data?: Array<{ url: string }>; error?: { message: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `DALL-E-2 HTTP ${res.status}`);
    const url = json.data?.[0]?.url;
    if (!url) throw new Error('DALL-E-2 returned no image URL');
    logger.info('[ContentGen] DALL-E 2 image generated, downloading…');
    const img = await fetch(url);
    if (!img.ok) throw new Error(`DALL-E-2 download failed: HTTP ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  };

  try {
    return await tryDalle3();
  } catch (err) {
    logger.warn(`[ContentGen] DALL-E 3 FAILED — ${(err as Error).message}`);
  }

  try {
    return await tryDalle2();
  } catch (err) {
    logger.warn(`[ContentGen] DALL-E 2 FAILED — ${(err as Error).message}`);
    throw new Error(`DALL-E 3: ver log anterior | DALL-E 2: ${(err as Error).message}`);
  }
}

function buildDallEPrompt(input: ContentInput): string {
  const scene           = input.visualConcept ?? 'modern professional scene, warm natural lighting';
  const campaignContext = input.description   ? ` Campaign: ${input.description}.` : '';
  return (
    `Realistic professional photograph for a social media advertisement. ` +
    `Brand: ${input.businessName}.${campaignContext} ` +
    `Photograph exactly this scene: ${scene}. ` +
    `Well-lit, bright, vibrant, editorial magazine quality. ` +
    `No text, no logos, no watermarks anywhere in the image. ` +
    `Leave the bottom 30% slightly uncluttered for text overlay.`
  );
}

async function syntheticBg(
  width:           number,
  height:          number,
  primaryColor:    string,
  secondaryColor?: string,
): Promise<Buffer> {
  // Default to an attractive dark-blue gradient when no brand colors are configured
  const primary = (primaryColor   && primaryColor.trim())   ? primaryColor   : '#2D6BFF';
  const secondary = (secondaryColor && secondaryColor.trim()) ? secondaryColor : '#0A0A1A';

  const { r: r1, g: g1, b: b1 } = hexToRgb(primary);
  const sec = secondary;
  const { r: r2, g: g2, b: b2 } = hexToRgb(sec);

  // Base layer: dark background color
  const base = await sharp({
    create: { width, height, channels: 3, background: { r: r2, g: g2, b: b2 } },
  }).png().toBuffer();

  // Accent overlay: lighter top-left glow using a raw pixel buffer (no SVG)
  // Build a horizontal gradient strip by tinting rows with the primary color
  const overlayPixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx    = (y * width + x) * 4;
      // Radial-ish soft glow centred at top-left (25%, 25%)
      const dx     = x / width  - 0.25;
      const dy     = y / height - 0.25;
      const dist   = Math.sqrt(dx * dx + dy * dy);
      const alpha  = Math.max(0, Math.round((1 - dist / 0.65) * 55));  // max ~22% opacity

      overlayPixels[idx]     = r1;
      overlayPixels[idx + 1] = g1;
      overlayPixels[idx + 2] = b1;
      overlayPixels[idx + 3] = alpha;
    }
  }

  return sharp(base)
    .composite([{ input: overlayPixels, raw: { width, height, channels: 4 }, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ── Claude: Design Decision ────────────────────────────────────────────────

function styleGuide(style: VariationStyle): string {
  switch (style) {
    case 'minimalist': return 'MINIMALIST: clean layout, small or medium text, subtle or no overlay (light-gradient or none), prefer bottom positions. Less is more.';
    case 'bold':       return 'BOLD/IMPACT: large text, strong-display or bold-sans font, high-opacity solid overlay (0.6-0.7), center or bottom-center position. Maximum visual impact.';
    case 'elegant':    return 'ELEGANT: elegant-serif font, medium text, dark gradient, bottom-right or bottom-center, opacity 0.45-0.55. Refined and sophisticated.';
    default:           return 'FREE: choose freely based on the copy and business type. Be creative — avoid bottom-left with dark-gradient (that is the default, pick something different).';
  }
}

function fallbackDesign(style: VariationStyle): DesignDecision {
  const map: Record<VariationStyle, DesignDecision> = {
    free:       { textPosition: 'top-left',      fontStyle: 'bold-sans',        textColor: 'white', overlayStyle: 'dark-gradient',  overlayOpacity: 0.60, fontSize: 'medium', reasoning: 'fallback-free'      },
    minimalist: { textPosition: 'bottom-center',  fontStyle: 'modern-condensed', textColor: 'white', overlayStyle: 'light-gradient', overlayOpacity: 0.38, fontSize: 'small',  reasoning: 'fallback-minimalist' },
    bold:       { textPosition: 'center',         fontStyle: 'strong-display',   textColor: 'white', overlayStyle: 'solid-overlay',  overlayOpacity: 0.68, fontSize: 'large',  reasoning: 'fallback-bold'       },
    elegant:    { textPosition: 'bottom-right',   fontStyle: 'elegant-serif',    textColor: 'white', overlayStyle: 'dark-gradient',  overlayOpacity: 0.50, fontSize: 'medium', reasoning: 'fallback-elegant'    },
  };
  return map[style];
}

function parseDesignDecision(text: string): DesignDecision | null {
  const attempts = [
    () => JSON.parse(text),
    () => { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (!m) throw 0; return JSON.parse(m[1].trim()); },
    () => { const m = text.match(/\{[\s\S]*\}/); if (!m) throw 0; return JSON.parse(m[0]); },
  ];
  for (const attempt of attempts) {
    try {
      const d = attempt() as Partial<DesignDecision>;
      if (d?.textPosition && d?.fontStyle && d?.overlayStyle) {
        return {
          textPosition:   d.textPosition,
          fontStyle:      d.fontStyle,
          textColor:      d.textColor      ?? 'white',
          overlayStyle:   d.overlayStyle,
          overlayOpacity: Math.min(0.85, Math.max(0.20, d.overlayOpacity ?? 0.55)),
          fontSize:       d.fontSize       ?? 'medium',
          reasoning:      d.reasoning      ?? '',
        };
      }
    } catch { /* next */ }
  }
  return null;
}

export async function getDesignDecision(
  input:     ContentInput,
  width:     number,
  height:    number,
  varStyle:  VariationStyle,
): Promise<DesignDecision> {
  const client = getDesignClient();
  if (!client) return fallbackDesign(varStyle);

  const prompt = `Ad image design brief. Return ONLY a single JSON object, no explanation, no markdown.

Image: ${width}×${height}px
Copy: "${input.copyText}"
Brand color: ${input.primaryColor}
Business: ${input.description ?? input.businessName}
Style focus: ${varStyle.toUpperCase()}

${styleGuide(varStyle)}

Return exactly this shape:
{"textPosition":"bottom-left","fontStyle":"bold-sans","textColor":"white","overlayStyle":"dark-gradient","overlayOpacity":0.55,"fontSize":"medium","reasoning":"one sentence"}

textPosition options: bottom-left, bottom-center, bottom-right, top-left, top-right, center
fontStyle options: bold-sans, elegant-serif, modern-condensed, strong-display
textColor options: white, black, brand-primary
overlayStyle options: dark-gradient, light-gradient, solid-overlay, none
overlayOpacity: number 0.3–0.7
fontSize: large, medium, small`;

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages:   [{ role: 'user', content: prompt }],
    }, { timeout: 12_000 });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const decision = parseDesignDecision(text);
    if (decision) return decision;
    logger.warn(`[ContentGen] Design decision parse failed, using fallback. Raw: ${text.slice(0, 120)}`);
  } catch (err) {
    logger.warn(`[ContentGen] getDesignDecision API error: ${(err as Error).message} — using fallback`);
  }
  return fallbackDesign(varStyle);
}

// ── Dynamic SVG overlay (Claude design decisions) ─────────────────────────

function getFontUrl(filename: string): string | null {
  const fullPath = path.join(FONTS_DIR, filename);
  if (!fs.existsSync(fullPath)) return null;
  return pathToFileURL(fullPath).toString();
}

interface TextLayout {
  textX:         number;
  textAnchor:    'start' | 'middle' | 'end';
  textStartY:    number;
  businessX:     number;
  businessAnchor: 'start' | 'middle' | 'end';
  businessY:     number;
}

function computeTextLayout(
  width: number, height: number, padding: number,
  fontPx: number, lineH: number, textBlockH: number, footerPx: number,
  position: TextPosition,
): TextLayout {
  const bottomMargin = Math.round(height * 0.10);
  const topMargin    = Math.round(height * 0.08);
  const bottomBizY   = height - Math.round(height * 0.028);
  const textBottomY  = height - bottomMargin - textBlockH + fontPx;

  switch (position) {
    case 'bottom-left':
      return { textX: padding,         textAnchor: 'start',  textStartY: textBottomY, businessX: padding,         businessAnchor: 'start',  businessY: bottomBizY };
    case 'bottom-center':
      return { textX: width / 2,       textAnchor: 'middle', textStartY: textBottomY, businessX: width / 2,       businessAnchor: 'middle', businessY: bottomBizY };
    case 'bottom-right':
      return { textX: width - padding, textAnchor: 'end',    textStartY: textBottomY, businessX: width - padding, businessAnchor: 'end',    businessY: bottomBizY };
    case 'top-left':
      return { textX: padding,         textAnchor: 'start',  textStartY: topMargin + fontPx,
               businessX: padding,         businessAnchor: 'start',  businessY: topMargin + textBlockH + fontPx + Math.round(fontPx * 0.6) };
    case 'top-right':
      return { textX: width - padding, textAnchor: 'end',    textStartY: topMargin + fontPx,
               businessX: width - padding, businessAnchor: 'end',    businessY: topMargin + textBlockH + fontPx + Math.round(fontPx * 0.6) };
    case 'center': {
      const midY = Math.round(height / 2);
      return { textX: width / 2, textAnchor: 'middle', textStartY: midY - Math.round(textBlockH / 2) + fontPx,
               businessX: width / 2, businessAnchor: 'middle', businessY: midY + Math.round(textBlockH / 2) + Math.round(fontPx * 0.85) };
    }
  }
}

function buildGradientDefs(
  width: number, height: number,
  design: DesignDecision,
): string {
  if (design.overlayStyle !== 'dark-gradient' && design.overlayStyle !== 'light-gradient') return '';

  const op    = design.overlayOpacity;
  const isTop = design.textPosition.startsWith('top');
  const color = design.overlayStyle === 'light-gradient' ? 'white' : 'black';
  const lightOp = +(op * 0.72).toFixed(2);
  const actualOp = design.overlayStyle === 'light-gradient' ? lightOp : op;

  if (isTop) {
    return `<linearGradient id="ov" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="${color}" stop-opacity="${actualOp}"/>
      <stop offset="65%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>`;
  }
  return `<linearGradient id="ov" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="${color}" stop-opacity="0"/>
    <stop offset="42%"  stop-color="${color}" stop-opacity="${+(actualOp * 0.28).toFixed(2)}"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="${actualOp}"/>
  </linearGradient>`;
}

function buildOverlayElement(
  width: number, height: number,
  design: DesignDecision,
): string {
  const { overlayStyle, overlayOpacity, textPosition } = design;
  if (overlayStyle === 'none') return '';

  if (overlayStyle === 'solid-overlay') {
    const isTop    = textPosition.startsWith('top');
    const isCenter = textPosition === 'center';
    if (isCenter) {
      const h = Math.round(height * 0.32); const y = Math.round(height * 0.34);
      return `<rect x="0" y="${y}" width="${width}" height="${h}" fill="rgba(0,0,0,${overlayOpacity})"/>`;
    }
    if (isTop) return `<rect x="0" y="0" width="${width}" height="${Math.round(height * 0.42)}" fill="rgba(0,0,0,${overlayOpacity})"/>`;
    return `<rect x="0" y="${Math.round(height * 0.54)}" width="${width}" height="${Math.round(height * 0.46)}" fill="rgba(0,0,0,${overlayOpacity})"/>`;
  }

  // gradient: full-image rect with gradient fill
  return `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#ov)"/>`;
}

function buildOverlaySVGWithDesign(
  width:  number,
  height: number,
  input:  ContentInput,
  design: DesignDecision,
): Buffer {
  const { r, g, b } = hexToRgb(input.primaryColor);
  const padding     = Math.round(width * 0.06);
  const accentH     = Math.max(4, Math.round(height * 0.006));

  const font      = FONT_CONFIG[design.fontStyle];
  const fontUrl   = getFontUrl(font.file);
  const fontDecl  = fontUrl
    ? `@font-face { font-family: '${font.family}'; src: url('${fontUrl}') format('woff'); font-weight: ${font.weight}; }`
    : '';
  const fontFamily = `'${font.family}', ${font.fallback}`;

  const sizeMul  = design.fontSize === 'large' ? 0.060 : design.fontSize === 'small' ? 0.038 : 0.050;
  // For vertical (9:16) canvases font must scale with height, not width, or
  // the text is too small relative to the taller frame.
  const isVert   = height > width;
  const fontPx   = isVert
    ? Math.round(height * sizeMul * 0.65)
    : Math.round(width  * sizeMul);
  const lineH    = Math.round(fontPx * 1.35);
  const footerPx = Math.round(fontPx * 0.48);

  const availableWidth = width - 2 * padding;
  const charsPerLine   = Math.max(10, Math.floor(availableWidth / (fontPx * 0.60)));
  const lines          = wordWrap(input.copyText, charsPerLine).slice(0, 3);
  const textBlockH     = lines.length * lineH;

  const textFill    = design.textColor === 'white'        ? 'white'
    : design.textColor === 'black'         ? '#111111'
    : `rgb(${r},${g},${b})`;
  const strokeColor = design.textColor === 'white' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.55)';

  const layout = computeTextLayout(width, height, padding, fontPx, lineH, textBlockH, footerPx, design.textPosition);

  const textEls = lines.map((line, i) =>
    `<text x="${layout.textX}" y="${layout.textStartY + i * lineH}" text-anchor="${layout.textAnchor}"
      font-family="${fontFamily}" font-size="${fontPx}" font-weight="${font.weight}"
      fill="${textFill}" paint-order="stroke" stroke="${strokeColor}" stroke-width="3"
      stroke-linejoin="round">${escapeXml(line)}</text>`,
  ).join('\n  ');

  const bizEl = `<text x="${layout.businessX}" y="${layout.businessY}" text-anchor="${layout.businessAnchor}"
    font-family="${fontFamily}" font-size="${footerPx}" font-weight="400"
    fill="${textFill}" opacity="0.65" letter-spacing="1.5">${escapeXml(input.businessName.toUpperCase())}</text>`;

  const accentEl = design.overlayStyle !== 'none'
    ? `<rect x="0" y="${height - accentH}" width="${width}" height="${accentH}" fill="rgb(${r},${g},${b})"/>`
    : '';

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontDecl}</style>
    ${buildGradientDefs(width, height, design)}
  </defs>
  ${buildOverlayElement(width, height, design)}
  ${accentEl}
  ${textEls}
  ${bizEl}
</svg>`);
}

// ── Sharp SVG overlay (gradient + text + accent bar) ─────────────────────

function buildOverlaySVG(
  width:       number,
  height:      number,
  input:       ContentInput,
  composition: 1 | 2 | 3 | 4 = 1,
): Buffer {
  const { r, g, b } = hexToRgb(input.primaryColor);
  const padding     = Math.round(width * 0.06);
  const accentH     = Math.max(6, Math.round(height * 0.008));

  // ── Composition 3: top-left scrim, text at top ─────────────────────────
  if (composition === 3) {
    const fontPx       = Math.round(width * 0.048);
    const lineH        = Math.round(fontPx * 1.38);
    const footerPx     = Math.round(fontPx * 0.52);
    const charsPerLine = Math.max(12, Math.floor((width - 2 * padding) / (fontPx * 0.60)));
    const lines        = wordWrap(input.copyText, charsPerLine).slice(0, 3);
    const firstTextY   = Math.round(height * 0.10) + fontPx;
    const textEls = lines.map((l, i) =>
      `<text x="${padding}" y="${firstTextY + i * lineH}"
        font-family="Arial,Helvetica,sans-serif" font-size="${fontPx}" font-weight="bold"
        fill="white" paint-order="stroke" stroke="rgba(0,0,0,0.6)" stroke-width="4"
        stroke-linejoin="round" letter-spacing="0.5">${escapeXml(l)}</text>`,
    ).join('');
    return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="s3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.40)}" fill="url(#s3)"/>
  <rect x="0" y="0" width="${width}" height="${accentH}" fill="rgb(${r},${g},${b})"/>
  ${textEls}
  <text x="${padding}" y="${Math.round(height * 0.075)}"
    font-family="Arial,Helvetica,sans-serif" font-size="${footerPx}"
    fill="white" opacity="0.65" letter-spacing="1.5">${escapeXml(input.businessName.toUpperCase())}</text>
</svg>`);
  }

  // ── Composition 4: solid dark band at bottom, centered bold text ────────
  if (composition === 4) {
    const bandH        = Math.round(height * 0.38);
    const bandY        = height - bandH;
    const fontPx       = Math.round(width * 0.054);
    const lineH        = Math.round(fontPx * 1.38);
    const footerPx     = Math.round(fontPx * 0.50);
    const charsPerLine = Math.max(12, Math.floor((width - 2 * padding) / (fontPx * 0.60)));
    const lines        = wordWrap(input.copyText, charsPerLine).slice(0, 3);
    const textBlockH   = lines.length * lineH;
    const textStartY   = bandY + Math.round((bandH - textBlockH) / 2) + fontPx;
    const cx           = width / 2;
    const textEls = lines.map((l, i) =>
      `<text x="${cx}" y="${textStartY + i * lineH}" text-anchor="middle"
        font-family="Arial,Helvetica,sans-serif" font-size="${fontPx}" font-weight="bold"
        fill="white" paint-order="stroke" stroke="rgba(0,0,0,0.4)" stroke-width="3"
        stroke-linejoin="round" letter-spacing="0.5">${escapeXml(l)}</text>`,
    ).join('');
    return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${bandY}" width="${width}" height="${bandH}" fill="rgba(0,0,0,0.82)"/>
  <rect x="0" y="${height - accentH}" width="${width}" height="${accentH}" fill="rgb(${r},${g},${b})"/>
  ${textEls}
  <text x="${cx}" y="${height - Math.round(height * 0.030)}" text-anchor="middle"
    font-family="Arial,Helvetica,sans-serif" font-size="${footerPx}"
    fill="white" opacity="0.60" letter-spacing="1.5">${escapeXml(input.businessName.toUpperCase())}</text>
</svg>`);
  }

  // ── Compositions 1 (standard) and 2 (light touch) ───────────────────────
  const isLight      = composition === 2;
  const isVertComp   = height > width;
  // Vertical canvases (9:16 reels) need larger text; base on height not width.
  const mainFontPx   = isVertComp
    ? Math.round(height * (isLight ? 0.029 : 0.034))
    : Math.round(width  * (isLight ? 0.044 : 0.050));
  const lineHeight   = Math.round(mainFontPx * 1.38);
  const footerPx     = Math.round(mainFontPx * 0.52);
  const charsPerLine = Math.max(12, Math.floor((width - 2 * padding) / (mainFontPx * 0.60)));
  const lines        = wordWrap(input.copyText, charsPerLine).slice(0, 3);
  const textBlockH   = lines.length * lineHeight;
  const gradientY    = Math.round(height * (isLight ? 0.52 : 0.40));
  const maxOpacity   = isLight ? 0.55 : 0.80;
  const textBottomY  = height - Math.round(height * 0.08) - Math.round(mainFontPx * 0.3);
  const textTopY     = textBottomY - textBlockH + mainFontPx;
  const footerY      = height - Math.round(height * 0.025);
  const textElements = lines.map((line, i) =>
    `<text x="${padding}" y="${textTopY + i * lineHeight}"
      font-family="Arial,Helvetica,sans-serif" font-size="${mainFontPx}" font-weight="bold"
      fill="white" paint-order="stroke" stroke="rgba(0,0,0,0.6)" stroke-width="4"
      stroke-linejoin="round" letter-spacing="0.5">${escapeXml(line)}</text>`,
  ).join('');

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0"/>
      <stop offset="35%"  stop-color="black" stop-opacity="${isLight ? 0.02 : 0.05}"/>
      <stop offset="100%" stop-color="black" stop-opacity="${maxOpacity}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${gradientY}" width="${width}" height="${height - gradientY}" fill="url(#scrim)"/>
  <rect x="0" y="${height - accentH}" width="${width}" height="${accentH}" fill="rgb(${r},${g},${b})"/>
  ${textElements}
  <text x="${padding}" y="${footerY}"
    font-family="Arial,Helvetica,sans-serif" font-size="${footerPx}"
    fill="white" opacity="0.60" letter-spacing="1.5">${escapeXml(input.businessName.toUpperCase())}</text>
</svg>`);
}

// ── Closing card: dedicated 1080×1920 layout ─────────────────────────────
// Purpose-built for the reel ending frame. Unlike the general overlay which
// is designed for square images, this one:
//   - Confines text to 85% of width (80px margins) with a black semi-transparent box
//   - Sizes font from height (not width) for vertical canvases, minimum 52px
//   - Hard-caps at 4 lines and truncates with "…" to prevent text overflow
//   - Places the logo at top-right with exactly 40px padding

function buildClosingCardSVG(
  width:  number,
  height: number,
  input:  ContentInput,
): Buffer {
  const { r, g, b } = hexToRgb(input.primaryColor);
  const hPad     = 80;
  const textW    = width - hPad * 2;
  const fontPx   = Math.max(52, Math.round(height * 0.034));
  const lineH    = Math.round(fontPx * 1.38);
  const inPad    = 28;
  const footerPx = Math.round(fontPx * 0.50);
  const accentH  = Math.max(4, Math.round(height * 0.005));

  const charsPerLine = Math.max(10, Math.floor(textW / (fontPx * 0.55)));
  const rawLines     = wordWrap(input.copyText, charsPerLine);
  const lines        = rawLines.slice(0, 4);
  if (rawLines.length > 4) {
    const last  = lines[3];
    const limit = charsPerLine - 1;
    lines[3]    = (last.length >= limit ? last.slice(0, limit - 1).trimEnd() : last) + '…';
  }

  const textBlockH = lines.length * lineH;
  const boxH       = inPad * 2 + textBlockH + Math.round(fontPx * 0.40) + footerPx;
  const boxY       = height - boxH - Math.round(height * 0.07);
  const textStartY = boxY + inPad + fontPx;
  const footerY    = boxY + inPad + textBlockH + Math.round(fontPx * 0.35) + footerPx;
  const gradientY  = Math.round(height * 0.45);

  const textEls = lines.map((line, i) =>
    `<text x="${hPad + inPad}" y="${textStartY + i * lineH}"
      font-family="Arial,Helvetica,sans-serif" font-size="${fontPx}" font-weight="bold"
      fill="white" paint-order="stroke" stroke="rgba(0,0,0,0.5)" stroke-width="3"
      stroke-linejoin="round">${escapeXml(line)}</text>`,
  ).join('\n  ');

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ccscrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.75"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${gradientY}" width="${width}" height="${height - gradientY}" fill="url(#ccscrim)"/>
  <rect x="${hPad}" y="${boxY}" width="${textW}" height="${boxH}" fill="rgba(0,0,0,0.72)" rx="12"/>
  ${textEls}
  <text x="${hPad + inPad}" y="${footerY}"
    font-family="Arial,Helvetica,sans-serif" font-size="${footerPx}" font-weight="400"
    fill="white" opacity="0.70" letter-spacing="1.5">${escapeXml(input.businessName.toUpperCase())}</text>
  <rect x="0" y="${height - accentH}" width="${width}" height="${accentH}" fill="rgb(${r},${g},${b})"/>
</svg>`);
}

async function composeClosingCard(
  bgBuf:      Buffer,
  input:      ContentInput,
  outputPath: string,
  width:      number,
  height:     number,
): Promise<void> {
  const composites: sharp.OverlayOptions[] = [
    { input: buildClosingCardSVG(width, height, input), top: 0, left: 0 },
  ];

  if (input.logoBuffer) {
    const logoPad     = 40;
    const logoMaxW    = Math.round(width * 0.18);
    const resizedLogo = await sharp(input.logoBuffer)
      .resize(logoMaxW, undefined, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    composites.push({
      input: resizedLogo,
      top:   logoPad,
      left:  width - (logoMeta.width ?? logoMaxW) - logoPad,
    });
  }

  await sharp(bgBuf)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .composite(composites)
    .toFile(outputPath);
}

// ── Shared helper: concat normalized AI clip + closing card → story + feed ────

async function buildStoryWithClosingCard(
  normalizedClipPath: string,
  imagePath:          string,
  input:              ContentInput,
  outputDir:          string,
  prefix:             string,
  feedOut:            string,
  storyOut:           string,
): Promise<{ feed: string; story: string }> {
  const clipDuration = 8;

  const bgBuf           = await sharp(imagePath).jpeg().toBuffer();
  const closingImgPath  = path.join(outputDir, `_tmp_${prefix}_closing.jpg`);
  const closingClipPath = path.join(outputDir, `_tmp_${prefix}_closing_clip.mp4`);
  await composeClosingCard(bgBuf, input, closingImgPath, 1080, 1920);
  await kenBurnsVideo(closingImgPath, closingClipPath, 1080, 1920, 3, null, 0.0003);

  const audio    = path.join(outputDir, `_tmp_${prefix}_audio.mp3`);
  let audioReady = false;
  try {
    await prepareAudio(audio, clipDuration + 4);
    audioReady = true;
  } catch (err) {
    logger.warn(`[ContentGen] ${prefix} audio failed:`, (err as Error).message);
  }

  const silentStory = path.join(outputDir, `_tmp_${prefix}_silent.mp4`);
  const listFile    = path.join(outputDir, `_tmp_${prefix}_list.txt`);
  fs.writeFileSync(listFile, [
    `file '${normalizedClipPath.replace(/\\/g, '/')}'`,
    `file '${closingClipPath.replace(/\\/g, '/')}'`,
  ].join('\n'));

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('libx264')
      .outputOptions(['-preset fast', '-crf 22', '-pix_fmt yuv420p'])
      .noAudio()
      .output(silentStory)
      .on('end', () => resolve())
      .on('error', (e: Error) => reject(new Error(`${prefix} concat: ${e.message}`)))
      .run();
  });

  if (audioReady) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(silentStory)
        .input(audio)
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate(128)
        .audioFilter(`afade=t=out:st=${clipDuration + 1}:d=2`)
        .outputOptions(['-shortest'])
        .output(storyOut)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`${prefix} mux: ${e.message}`)))
        .run();
    });
    try { fs.unlinkSync(silentStory); } catch { /* ignore */ }
  } else {
    fs.renameSync(silentStory, storyOut);
  }

  await cropFillVideoClip(normalizedClipPath, feedOut, 1080, 1080);
  logger.info(`[ContentGen] ${prefix} professional video ready (story: ${clipDuration + 3}s, feed: ${clipDuration}s)`);
  return { feed: feedOut, story: storyOut };
}

// ── KIE.ai: Hailuo 2.3 clip (Plan Professional — image → video + closing card) ──

function imagePathToPublicUrl(imagePath: string): string | null {
  const backendUrl  = process.env['BACKEND_URL'] ?? 'http://localhost:4000';
  const uploadsBase = process.env['UPLOADS_DIR']
    ? path.resolve(process.env['UPLOADS_DIR'])
    : path.resolve('./uploads');
  const relative = path.relative(uploadsBase, path.resolve(imagePath));
  if (relative.startsWith('..')) return null;
  return `${backendUrl}/uploads/${relative.replace(/\\/g, '/')}`;
}

async function generateHailuoClip(
  imagePath: string,
  input:     ContentInput,
  outputDir: string,
): Promise<{ feed: string; story: string } | null> {
  if (!(process.env['KIE_API_KEY'] ?? '')) {
    logger.warn('[Hailuo] KIE_API_KEY not configured — skipping');
    return null;
  }

  const storyOut = path.join(outputDir, 'professional_story.mp4');
  const feedOut  = path.join(outputDir, 'professional_feed.mp4');

  // Hailuo deforms AI-baked copy text when animating it, so animate a clean
  // (no-text) regeneration of the same scene instead — the copy is added
  // back afterward via applyVideoOverlays. Falls back to the branded
  // variation (with text) if the clean regeneration fails: a video with
  // deformed text beats no video.
  let hailuoSourceImg = imagePath;
  if (input.visualConcept) {
    try {
      const cleanBuf      = await generateCleanBrandImage(input, 1080, 1080, false);
      const cleanImgPath  = path.join(outputDir, '_tmp_hailuo_clean.jpg');
      fs.writeFileSync(cleanImgPath, cleanBuf);
      hailuoSourceImg = cleanImgPath;
      logger.info('[Hailuo] Using clean (no-text) regenerated scene as source frame');
    } catch (err) {
      logger.warn(`[Hailuo] Clean image generation failed, using branded variation: ${(err as Error).message}`);
    }
  }

  const basePrompt = input.visualConcept ? await buildEnhancedVideoPrompt(input) : `Professional advertising video for ${input.businessName}`;
  const prompt     = `${basePrompt} No text, no signs, no captions, no subtitles, no watermarks, no UI elements.`;
  const rawPath    = await kie.generateHailuoVideo(prompt, hailuoSourceImg, outputDir);

  // Normalize Hailuo 10s clip to 1080×1920
  const hailuoNorm = path.join(outputDir, '_tmp_hailuo_norm.mp4');
  await normalizeVideoClip(rawPath, hailuoNorm, 1080, 1920, 10);

  // Closing card image + 3s Ken Burns clip
  const closingImgPath  = path.join(outputDir, '_tmp_hailuo_closing.jpg');
  const closingClipPath = path.join(outputDir, '_tmp_hailuo_closing.mp4');
  const bgBuf = await sharp(imagePath).jpeg().toBuffer();
  await composeClosingCard(bgBuf, input, closingImgPath, 1080, 1920);
  await kenBurnsVideo(closingImgPath, closingClipPath, 1080, 1920, 3, null, 0.0003);

  // Audio (14s headroom for 13s video)
  const audio = path.join(outputDir, '_tmp_hailuo_audio.mp3');
  let audioReady = false;
  try {
    await prepareAudio(audio, 14);
    audioReady = true;
  } catch (err) {
    logger.warn('[Hailuo] Audio failed:', (err as Error).message);
  }

  // Concat hailuo(10s) + closing(3s) = 13s story
  const silentStory = path.join(outputDir, '_tmp_hailuo_silent.mp4');
  const listFile    = path.join(outputDir, '_tmp_hailuo_list.txt');
  fs.writeFileSync(listFile, [
    `file '${hailuoNorm.replace(/\\/g, '/')}'`,
    `file '${closingClipPath.replace(/\\/g, '/')}'`,
  ].join('\n'));

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('libx264')
      .outputOptions(['-preset fast', '-crf 22', '-pix_fmt yuv420p'])
      .noAudio()
      .output(silentStory)
      .on('end', () => resolve())
      .on('error', (e: Error) => reject(new Error(`Hailuo concat: ${e.message}`)))
      .run();
  });

  if (audioReady) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(silentStory)
        .input(audio)
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate(128)
        .audioFilter('afade=t=out:st=11:d=2')
        .outputOptions(['-shortest'])
        .output(storyOut)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`Hailuo mux: ${e.message}`)))
        .run();
    });
    try { fs.unlinkSync(silentStory); } catch { /* ignore */ }
  } else {
    fs.renameSync(silentStory, storyOut);
  }

  const feedSilent = path.join(outputDir, '_tmp_hailuo_feed_silent.mp4');
  await cropFillVideoClip(hailuoNorm, feedSilent, 1080, 1080);

  if (audioReady) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(feedSilent)
        .input(audio)
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate(128)
        .audioFilter('afade=t=out:st=8:d=2')
        .outputOptions(['-shortest'])
        .output(feedOut)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`Hailuo feed mux: ${e.message}`)))
        .run();
    });
    try { fs.unlinkSync(feedSilent); } catch { /* ignore */ }
  } else {
    fs.renameSync(feedSilent, feedOut);
  }

  logger.info('[Hailuo] Professional video ready (story: 13s, feed: 10s)');
  return { feed: feedOut, story: storyOut };
}

// ── KIE.ai: Grok clip (Plan Premium + Plan Professional) ──────────────────

async function generateGrokClip(
  input:     ContentInput,
  outputDir: string,
): Promise<string | null> {
  if (!input.visualConcept) {
    logger.warn('[Grok] visualConcept empty — skipping');
    return null;
  }
  if (!(process.env['KIE_API_KEY'] ?? '')) {
    logger.warn('[Grok] KIE_API_KEY not configured — skipping');
    return null;
  }
  const prompt     = await buildEnhancedVideoPrompt(input);
  const rawPath    = await kie.generateGrokVideo(prompt, outputDir);
  const normalized = path.join(outputDir, '_tmp_grok_clip.mp4');
  await normalizeVideoClip(rawPath, normalized, 1080, 1920);

  return normalized;
}

// ── Kling 3.0: generate clip via Higgsfield CLI ───────────────────────────

const CAR_DETAILING_PATTERN = /ceramic\s*coating|car\s*detail|auto\s*detail|paint\s*protection|detailing|applicator\s*pad/i;

const CAR_DETAILING_HINT =
  'The ceramic coating is a very thin, light liquid (NOT gel, NOT oil, NOT viscous). ' +
  'When applied with a microfiber applicator pad, it barely dampens the surface with an almost invisible thin film. ' +
  'The motion is smooth and light, like wiping with a slightly damp cloth. ' +
  'No thick drips, no glossy gel streaks, no oil-like viscosity.';

function buildKling3Prompt(input: ContentInput): string {
  const scene   = input.visualConcept ?? `professional scene for ${input.businessName}`;
  const hint    = CAR_DETAILING_PATTERN.test(scene) ? ` ${CAR_DETAILING_HINT}` : '';
  const focus   = input.postFocus   ? ` Focus: ${input.postFocus}.`   : '';
  const context = input.description ? ` Context: ${input.description}.` : '';
  return (
    `Cinematic 8-second advertising video for ${input.businessName}. ` +
    `Vertical 9:16 format for Instagram Reels and TikTok. ` +
    `${scene}.${hint}${focus}${context} ` +
    `Smooth camera movement, warm professional lighting, rich colors. ` +
    `No text, no logos, no watermarks.`
  );
}

async function buildEnhancedVideoPrompt(input: ContentInput): Promise<string> {
  try {
    const baseScene     = input.visualConcept ?? `professional scene for ${input.businessName}`;
    const visualConcept = input.postFocus
      ? `${baseScene}. Key focus: ${input.postFocus}`
      : baseScene;
    const enhanced = await generateVideoPrompt({
      visualConcept,
      businessName:  input.businessName,
      copyText:      input.copyText,
      businessType:  input.description ?? input.businessName,
      primaryColor:  input.primaryColor,
    });
    logger.info('[ContentGen] Enhanced video prompt generated via Claude Haiku');
    return enhanced;
  } catch (err) {
    logger.warn(`[ContentGen] Video prompt enhancement failed: ${(err as Error).message} — using basic prompt`);
    return buildKling3Prompt(input);
  }
}

function extractVideoUrl(stdout: string): string | null {
  try {
    const data = JSON.parse(stdout);
    const job  = Array.isArray(data) ? data[0] : data;
    const candidates = [
      job?.output?.url,
      job?.output?.uri,
      job?.results?.[0]?.url,
      job?.results?.[0]?.uri,
      job?.media?.[0]?.url,
      job?.video?.url,
      job?.video?.uri,
    ];
    const found = candidates.find(c => typeof c === 'string' && (c as string).startsWith('http'));
    if (found) return found as string;
  } catch { /* fall through to regex */ }
  const match = stdout.match(/https?:\/\/[^\s"',]+\.mp4(?:\?[^\s"',]*)?/);
  return match?.[0] ?? null;
}

// Run one Higgsfield CLI subcommand and return its trimmed stdout.
// shell is ONLY enabled on Windows, to resolve the .cmd shim for local dev —
// with shell:true, Node concatenates argv into a single string and hands it to
// sh -c, which re-splits on whitespace; a --prompt value with spaces would
// blow up into extra positional args ("Too many positional args") on Linux.
// With shell:false (production), args are passed as a real argv array with no
// re-parsing, so multi-word --prompt/--start-image values survive intact.
function runHiggsfieldCli(args: string[], timeoutMs: number): Promise<string> {
  const isWindows = process.platform === 'win32';
  const higgsCmd  = isWindows ? 'higgsfield.cmd' : 'higgsfield';

  return new Promise<string>((resolve, reject) => {
    const child = spawn(higgsCmd, args, { shell: isWindows, stdio: ['ignore', 'pipe', 'pipe'] });

    let out = '';
    let err = '';
    child.stdout!.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr!.on('data', (d: Buffer) => { err += d.toString(); });

    const killTimer = setTimeout(() => {
      child.kill();
      reject(new Error(`[Kling3] CLI command timed out after ${Math.round(timeoutMs / 1000)}s: ${args.join(' ')}`));
    }, timeoutMs);

    child.on('close', (code: number | null) => {
      clearTimeout(killTimer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`higgsfield ${args.slice(0, 2).join(' ')} exited with code ${code ?? 'null'}: ${err.slice(0, 400)}`));
    });

    child.on('error', (e: Error) => {
      clearTimeout(killTimer);
      reject(e);
    });
  });
}

export async function generateKling3Video(
  imagePath:         string,
  input:             ContentInput,
  outputDir:         string,
  sourceImagePath?:  string,
  outputTag?:        string,
  exactDurationSec?: number,
): Promise<string | null> {
  if (!input.visualConcept) {
    logger.warn('[Kling3] visualConcept empty — skipping Kling 3.0');
    return null;
  }

  logger.info(`[Kling3] Starting video generation for "${input.businessName}"`);

  // Kling deforms AI-baked copy text the same way Hailuo does, so animate a
  // clean (no-text) regeneration of the scene instead. Falls back to the
  // branded variation (with text) if the clean regeneration fails.
  // If sourceImagePath is provided, the caller already has a clean scene
  // image it wants reused as-is (e.g. anchoring multiple clips to the same
  // base image) — use it directly and skip regenerating a new one.
  let kling3SourceImg = imagePath;
  if (sourceImagePath) {
    kling3SourceImg = sourceImagePath;
    logger.info('[Kling3] Using provided source image (no regeneration)');
  } else {
    try {
      const cleanBuf     = await generateCleanBrandImage(input, 1080, 1920, false);
      const cleanImgPath = path.join(outputDir, '_tmp_kling3_clean.jpg');
      fs.writeFileSync(cleanImgPath, cleanBuf);
      kling3SourceImg = cleanImgPath;
      logger.info('[Kling3] Using clean (no-text) regenerated scene as source frame');
    } catch (err) {
      logger.warn(`[Kling3] Clean image generation failed, using branded variation: ${(err as Error).message}`);
    }
  }

  const basePrompt = await buildEnhancedVideoPrompt(input);
  const prompt     = `${basePrompt} No text, no signs, no captions, no subtitles, no watermarks, no UI elements.`;

  // 1. Upload the source image — stdout is the bare upload_id (UUID).
  logger.info('[Kling3] Uploading source image…');
  const uploadId = await runHiggsfieldCli(['upload', 'create', kling3SourceImg], 2 * 60 * 1000);
  if (!uploadId) throw new Error('[Kling3] upload create returned no upload_id');
  logger.info(`[Kling3] Uploaded → ${uploadId}`);

  // 2. Create the generation job — stdout is the bare job_id (no --wait here;
  //    we poll explicitly in step 3 so job creation itself returns quickly).
  const jobId = await runHiggsfieldCli([
    'generate', 'create', 'kling3_0',
    '--prompt',       prompt,
    '--start-image',  uploadId,
    '--duration',     '10',
    '--aspect-ratio', '9:16',
    '--mode',         'std',
  ], 60 * 1000);
  if (!jobId) throw new Error('[Kling3] generate create returned no job_id');
  logger.info(`[Kling3] Job started: ${jobId}`);

  // 3. Wait for the job — stdout prints the result video URL on completion.
  const waitOut = await runHiggsfieldCli(
    ['generate', 'wait', jobId, '--timeout', '12m', '--quiet'],
    13 * 60 * 1000,
  );
  const videoUrl = extractVideoUrl(waitOut);
  if (!videoUrl) throw new Error(`[Kling3] No video URL found in wait output: ${waitOut.slice(0, 300)}`);

  logger.info(`[Kling3] Video generated, downloading: ${videoUrl.slice(0, 80)}…`);
  const dlRes = await fetch(videoUrl);
  if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());

  const postId  = input.campaignId ?? `reel-${Date.now()}`;
  const saveDir = path.join(
    process.env['UPLOADS_DIR'] ? path.resolve(process.env['UPLOADS_DIR']) : path.resolve('./uploads'),
    'videos', postId,
  );
  fs.mkdirSync(saveDir, { recursive: true });
  const rawPath = path.join(saveDir, `kling3_${Date.now()}.mp4`);
  fs.writeFileSync(rawPath, buf);
  logger.info(`[Kling3] Raw video saved: ${rawPath} (${Math.round(buf.length / 1024)} KB)`);

  const normalized = path.join(outputDir, outputTag ? `_tmp_${outputTag}_kling3.mp4` : '_tmp_reel_clip1_kling3.mp4');
  if (exactDurationSec) {
    await normalizeVideoClipExact(rawPath, normalized, 1080, 1920, exactDurationSec);
  } else {
    await normalizeVideoClip(rawPath, normalized, 1080, 1920);
  }

  return normalized;
}

// ── Veo 2: generate clip and normalize to our spec ────────────────────────

async function generateVeoClip(
  input:     ContentInput,
  outputDir: string,
): Promise<string | null> {
  if (!input.visualConcept) {
    logger.warn('[generateVeoClip] visualConcept empty — skipping Veo 2');
    return null;
  }

  const apiKeyPresent = !!(process.env['GEMINI_API_KEY'] ?? '');
  logger.info(`[generateVeoClip] GEMINI_API_KEY: ${apiKeyPresent ? `presente (${(process.env['GEMINI_API_KEY'] ?? '').slice(0, 8)}…)` : '*** FALTA ***'}`);
  logger.info(`[generateVeoClip] businessName:   "${input.businessName}"`);
  logger.info(`[generateVeoClip] visualConcept:  "${input.visualConcept.slice(0, 400)}"`);
  logger.info(`[generateVeoClip] copyText:       "${input.copyText?.slice(0, 120) ?? ''}"`);

  const result = await generateVideo({
    prompt:       input.visualConcept,
    businessName: input.businessName,
    copyText:     input.copyText,
    clientPhotos: input.clientPhotos ?? [],
    campaignId:   input.campaignId ?? 'reel',
    strategyId:   `reel-${Date.now()}`,
    aspectRatio:  '9:16',
    durationSec:  8,
  });

  logger.info(`[generateVeoClip] result: filePath=${result.filePath ?? 'null'}, jobId=${result.jobId}`);

  if (!result.filePath) {
    logger.warn('[generateVeoClip] filePath null — Veo 2 failed, using fallback');
    return null;
  }

  // /uploads/videos/... → absolute path
  const match = result.filePath.match(/\/uploads\/(.+)$/);
  if (!match) {
    logger.warn(`[generateVeoClip] Cannot parse filePath: ${result.filePath}`);
    return null;
  }
  const uploadsBase = process.env['UPLOADS_DIR']
    ? path.resolve(process.env['UPLOADS_DIR'])
    : path.resolve('./uploads');
  const srcPath = path.join(uploadsBase, match[1]);
  logger.info(`[generateVeoClip] absolute video path: ${srcPath} (exists: ${fs.existsSync(srcPath)})`);
  if (!fs.existsSync(srcPath)) return null;

  // Normalize: 1080×1920, 25fps, h264, yuv420p, max 8s
  const normalized = path.join(outputDir, '_tmp_reel_clip1_veo.mp4');
  logger.info(`[generateVeoClip] Normalizing to ${normalized}…`);
  await normalizeVideoClip(srcPath, normalized, 1080, 1920);

  return normalized;
}

// ── Premium video (real end-to-end video): per-clip fallback chain ────────
// Same chain as the mixed reel (Grok → Kling 3.0 → Veo 2 → Ken Burns), but
// every model is called image-to-video, anchored to the SAME base image, and
// every output is padded/trimmed to an exact duration so the 3 clips line up
// for concatWithXfade.

async function generatePremiumVideoClip(
  input:          ContentInput,
  baseImgPath:    string,
  outputDir:      string,
  clipIndex:      number,
  targetDuration: number,
): Promise<string> {
  const tag = `video_clip${clipIndex + 1}`;

  logger.info(`[ContentGen] Video — ${tag}: Grok (KIE.ai) image-to-video…`);
  try {
    const grokPath = await generateGrokClipFromImage(input, baseImgPath, outputDir, tag, targetDuration);
    if (!grokPath) throw new Error('Grok returned null');
    logger.info(`[ContentGen] Video — ${tag}: Grok success`);
    return grokPath;
  } catch (grokErr) {
    logger.warn(`[ContentGen] Video — ${tag}: Grok failed: ${(grokErr as Error).message} — trying Kling 3.0…`);
  }

  try {
    const klingPath = await generateKling3Video(baseImgPath, input, outputDir, baseImgPath, tag, targetDuration);
    if (!klingPath) throw new Error('Kling 3.0 returned null');
    logger.info(`[ContentGen] Video — ${tag}: Kling 3.0 success`);
    return klingPath;
  } catch (klingErr) {
    logger.warn(`[ContentGen] Video — ${tag}: Kling 3.0 failed: ${(klingErr as Error).message} — trying Veo 2…`);
  }

  try {
    const veoPath = await generateVeoClipFromImage(input, baseImgPath, outputDir, tag, targetDuration);
    if (!veoPath) throw new Error('Veo 2 returned null');
    logger.info(`[ContentGen] Video — ${tag}: Veo 2 success`);
    return veoPath;
  } catch (veoErr) {
    logger.warn(`[ContentGen] Video — ${tag}: Veo 2 failed: ${(veoErr as Error).message} — Ken Burns fallback`);
  }

  const kb = path.join(outputDir, `_tmp_${tag}_kb.mp4`);
  await kenBurnsVideo(baseImgPath, kb, 1080, 1920, targetDuration, null, 0.0015 + clipIndex * 0.0003);
  return kb;
}

async function generateGrokClipFromImage(
  input:          ContentInput,
  baseImgPath:    string,
  outputDir:      string,
  tag:            string,
  targetDuration: number,
): Promise<string | null> {
  if (!input.visualConcept) return null;
  if (!(process.env['KIE_API_KEY'] ?? '')) {
    logger.warn(`[Grok] KIE_API_KEY not configured — skipping (${tag})`);
    return null;
  }

  const prompt     = await buildEnhancedVideoPrompt(input);
  const imageUrl   = await kie.uploadImageToKie(baseImgPath);
  const rawPath    = await kie.generateGrokVideoFromImage(prompt, imageUrl, outputDir);
  const normalized = path.join(outputDir, `_tmp_${tag}_grok.mp4`);
  await normalizeVideoClipExact(rawPath, normalized, 1080, 1920, targetDuration);

  return normalized;
}

async function generateVeoClipFromImage(
  input:          ContentInput,
  baseImgPath:    string,
  outputDir:      string,
  tag:            string,
  targetDuration: number,
): Promise<string | null> {
  if (!input.visualConcept) return null;

  const baseImgB64 = fs.readFileSync(baseImgPath).toString('base64');

  const result = await generateVideo({
    prompt:       input.visualConcept,
    businessName: input.businessName,
    copyText:     input.copyText,
    clientPhotos: [baseImgB64],
    campaignId:   input.campaignId ?? 'video',
    strategyId:   `video-${tag}-${Date.now()}`,
    aspectRatio:  '9:16',
    durationSec:  8,
  });

  if (!result.filePath) {
    logger.warn(`[generateVeoClipFromImage] filePath null — Veo 2 failed (${tag})`);
    return null;
  }

  const match = result.filePath.match(/\/uploads\/(.+)$/);
  if (!match) {
    logger.warn(`[generateVeoClipFromImage] Cannot parse filePath: ${result.filePath}`);
    return null;
  }
  const uploadsBase = process.env['UPLOADS_DIR']
    ? path.resolve(process.env['UPLOADS_DIR'])
    : path.resolve('./uploads');
  const srcPath = path.join(uploadsBase, match[1]);
  if (!fs.existsSync(srcPath)) return null;

  const normalized = path.join(outputDir, `_tmp_${tag}_veo.mp4`);
  await normalizeVideoClipExact(srcPath, normalized, 1080, 1920, targetDuration);

  return normalized;
}

// Re-encode a video clip to a known spec so it can be safely concatenated
function normalizeVideoClip(
  inputPath:   string,
  outputPath:  string,
  width:       number,
  height:      number,
  maxDuration: number = 8,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .videoFilter(
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,` +
        `format=yuv420p`,
      )
      .videoCodec('libx264')
      .outputOptions(['-r 25', '-preset fast', '-crf 22', `-t ${maxDuration}`])
      .noAudio()
      .output(outputPath)
      .on('end',   () => resolve())
      .on('error', (e: Error) => reject(new Error(`normalizeVideoClip: ${e.message}`)))
      .run();
  });
}

// Like normalizeVideoClip, but guarantees an EXACT output duration regardless
// of the source's native length: pads with a cloned last frame (tpad) if the
// clip is shorter than the target, then hard-trims to the target. Used when
// clips from different AI models (each with its own native duration) must
// line up exactly for concatWithXfade, whose crossfade offsets assume every
// clip shares the same clipDuration.
function normalizeVideoClipExact(
  inputPath:     string,
  outputPath:    string,
  width:         number,
  height:        number,
  exactDuration: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .videoFilter(
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,` +
        `format=yuv420p,` +
        `tpad=stop_mode=clone:stop_duration=${exactDuration}`,
      )
      .videoCodec('libx264')
      .outputOptions(['-r 25', '-preset fast', '-crf 22', `-t ${exactDuration}`])
      .noAudio()
      .output(outputPath)
      .on('end',   () => resolve())
      .on('error', (e: Error) => reject(new Error(`normalizeVideoClipExact: ${e.message}`)))
      .run();
  });
}

// Crop-fill resize: scale to cover, then center-crop (no letterbox)
function cropFillVideoClip(
  inputPath:  string,
  outputPath: string,
  width:      number,
  height:     number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .videoFilter(
        `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},` +
        `format=yuv420p`,
      )
      .videoCodec('libx264')
      .outputOptions(['-preset fast', '-crf 22'])
      .noAudio()
      .output(outputPath)
      .on('end',   () => resolve())
      .on('error', (e: Error) => reject(new Error(`cropFillVideoClip: ${e.message}`)))
      .run();
  });
}

// ── FFmpeg: Text + Logo overlay ────────────────────────────────────────────

// Save a logoBuffer to a temp PNG so FFmpeg can read it as an input file.
async function logoBufferToTempPath(
  logoBuffer: Buffer | undefined,
  tmpDir:     string,
): Promise<string | null> {
  if (!logoBuffer) return null;
  const p = path.join(tmpDir, '_tmp_logo_overlay.png');
  fs.writeFileSync(p, logoBuffer);
  return p;
}

// Escape text for FFmpeg drawtext `text=` value wrapped in single quotes.
// Inside single-quoted FFmpeg values, \ is a LITERAL character — not an escape.
// To include a ' you must end the quote, write \', then reopen: e.g. '\''
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '/')       // backslash → forward slash (safe in displayed text)
    .replace(/'/g,  "'\\''");  // ' → end-quote + \' + reopen-quote (FFmpeg single-quote escape)
}

// Escape a file path for use in a drawtext `fontfile=` option (path is inside single quotes,
// so only backslashes need converting — colons must NOT be escaped inside quoted strings).
function escapeFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Apply copy text + logo overlays to a video file using FFmpeg drawtext/overlay.
 *
 * Text: Arial Bold 36px, white with black shadow, semi-transparent black box,
 *       word-wrapped, bottom-center with 40px padding.
 * Logo: top-right corner, max 120×60px (aspect-ratio preserved), 20px padding.
 *
 * Audio is copied as-is (no re-encode).
 */
export async function applyVideoOverlays(
  videoPath:   string,
  copyText:    string,
  logoPath:    string | null,
  overlayLogo: boolean,
  overlayCopy: boolean,
  outputPath:  string,
): Promise<void> {
  const hasLogo = overlayLogo && !!(logoPath && fs.existsSync(logoPath));
  const lines   = overlayCopy ? wordWrap(copyText, 30).slice(0, 4) : [];
  const hasText = lines.length > 0;

  if (!hasLogo && !hasText) {
    fs.copyFileSync(videoPath, outputPath);
    return;
  }

  const fontSize = 36;
  const lineH    = Math.round(fontSize * 1.4);  // ≈ 50 px

  // fontfile= path must NOT use escapeFfmpegPath (path is inside single quotes — colon is safe)
  let fontFilePart = '';
  if (hasText) {
    const fontCandidates = [
      path.join(FONTS_DIR, 'Poppins-Bold.ttf'), // bundled — works regardless of OS fonts installed
      'C:/Windows/Fonts/arialbd.ttf',
      '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    ];
    const found = fontCandidates.find(fp => fs.existsSync(fp)) ?? null;
    fontFilePart = found ? `fontfile='${escapeFfmpegPath(found)}':` : '';
  }

  // One drawtext filter per line, stacked bottom-up; last line sits at y=h-th-80
  const drawTextFilters = lines.map((line, i) => {
    const offset = (lines.length - 1 - i) * lineH;
    const yExpr  = offset > 0 ? `h-th-80-${offset}` : 'h-th-80';
    return (
      `drawtext=${fontFilePart}text='${escapeDrawtext(line)}':` +
      `fontsize=${fontSize}:fontcolor=white:` +
      `shadowcolor=black:shadowx=3:shadowy=3:` +
      `box=1:boxcolor=black@0.6:boxborderw=15:` +
      `x=w*0.05:y=${yExpr}:fix_bounds=1`
    );
  });

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(videoPath);

    if (hasLogo && hasText) {
      cmd.input(logoPath!);
      cmd.complexFilter(
        `[0:v]format=yuv420p[vid];` +
        `[1:v]scale=360:180:force_original_aspect_ratio=decrease:flags=lanczos[logo];` +
        `[vid][logo]overlay=W-w-20:20[base];` +
        `[base]${drawTextFilters.join(',')}[outv]`,
      );
      cmd.outputOptions(['-map [outv]', '-map 0:a:0?', '-c:a aac', '-b:a 128k']);
    } else if (hasLogo) {
      cmd.input(logoPath!);
      cmd.complexFilter(
        `[0:v]format=yuv420p[vid];` +
        `[1:v]scale=360:180:force_original_aspect_ratio=decrease:flags=lanczos[logo];` +
        `[vid][logo]overlay=W-w-20:20[outv]`,
      );
      cmd.outputOptions(['-map [outv]', '-map 0:a:0?', '-c:a aac', '-b:a 128k']);
    } else {
      // Text only — complexFilter with explicit [0:v] handles any stream ordering
      // (e.g. audio at index 0, video at index 1) without -vf injection errors
      cmd.complexFilter(`[0:v]format=yuv420p,${drawTextFilters.join(',')}[outv]`);
      cmd.outputOptions(['-map [outv]', '-map 0:a:0?', '-c:a aac', '-b:a 128k']);
    }

    cmd
      .output(outputPath)
      .on('end',   () => { logger.info(`[applyVideoOverlays] Done: ${path.basename(outputPath)}`); resolve(); })
      .on('error', (e: Error) => reject(new Error(`applyVideoOverlays: ${e.message}`)))
      .run();
  });
}

// ── FFmpeg: Ken Burns ──────────────────────────────────────────────────────

function kenBurnsVideo(
  inputImg:  string,
  outputMp4: string,
  width:     number,
  height:    number,
  duration:  number,
  audioPath: string | null,
  zoomSpeed: number = 0.0012,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fps         = 25;
    const totalFrames = fps * duration;

    // Upscale 1.6x so zoompan has headroom, then crop back
    const upW = Math.round(width  * 1.6);
    const upH = Math.round(height * 1.6);

    const videoFilter = [
      `scale=${upW}:${upH}`,
      `zoompan=z='min(zoom+${zoomSpeed},1.5)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
      `scale=${width}:${height}:flags=lanczos`,
      `format=yuv420p`,
      `fade=t=in:st=0:d=1`,
      `fade=t=out:st=${duration - 1}:d=1`,
    ].join(',');

    const cmd = ffmpeg()
      .input(inputImg)
      .inputOptions(['-loop 1'])
      .videoFilter(videoFilter)
      .videoCodec('libx264')
      .outputOptions([
        `-t ${duration}`,
        `-r ${fps}`,
        `-preset fast`,
        `-crf 22`,
      ]);

    if (audioPath && fs.existsSync(audioPath)) {
      cmd
        .input(audioPath)
        .audioCodec('aac')
        .audioBitrate(128)
        .outputOptions(['-shortest']);
    } else {
      cmd.noAudio();
    }

    cmd
      .output(outputMp4)
      .on('start', (c: string) => logger.debug('[FFmpeg ken-burns]', { cmd: c.slice(0, 100) }))
      .on('end',   () => { logger.info(`[FFmpeg] Done: ${path.basename(outputMp4)}`); resolve(); })
      .on('error', (e: Error) => reject(new Error(`FFmpeg ken-burns: ${e.message}`)))
      .run();
  });
}

// ── FFmpeg: Concatenate + mix audio ───────────────────────────────────────

async function concatWithAudio(
  clips:     string[],
  audioPath: string | null,
  output:    string,
  tmpDir:    string,
): Promise<void> {
  // Step 1: concat clips (no audio)
  const silentOut  = path.join(tmpDir, '_tmp_concat_silent.mp4');
  const listFile   = path.join(tmpDir, '_tmp_concat.txt');
  const listContent = clips.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('libx264')
      .outputOptions(['-preset fast', '-crf 22', '-pix_fmt yuv420p'])
      .noAudio()
      .output(silentOut)
      .on('end',   () => resolve())
      .on('error', (e: Error) => reject(new Error(`Concat: ${e.message}`)))
      .run();
  });

  // Step 2: mux audio (if available)
  if (audioPath && fs.existsSync(audioPath)) {
    const totalDuration = clips.length * 8;
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(silentOut)
        .input(audioPath)
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate(128)
        .audioFilter(`afade=t=out:st=${totalDuration - 2}:d=2`)
        .outputOptions(['-shortest'])
        .output(output)
        .on('end',   () => resolve())
        .on('error', (e: Error) => reject(new Error(`Mux: ${e.message}`)))
        .run();
    });
    try { fs.unlinkSync(silentOut); } catch { /* ignore */ }
  } else {
    // No audio — just rename the silent concat
    fs.renameSync(silentOut, output);
  }

}

// ── FFmpeg: Concatenate with xfade transitions ────────────────────────────
//
// Chains clips with the ffmpeg xfade filter (crossfade / slideup etc.).
// clipDuration must match the duration passed to kenBurnsVideo for each clip.
// Two-step: (1) xfade concat to a silent temp file, (2) mux audio.

async function concatWithXfade(
  clips:              string[],
  audioPath:          string | null,
  output:             string,
  tmpDir:             string,
  clipDuration:       number   = 4,
  transitionDuration: number   = 0.5,
  transitions:        string[] = ['fade', 'slideup'],
): Promise<void> {
  const silentOut = path.join(tmpDir, `_tmp_xfade_silent_${Date.now()}.mp4`);

  // Step 1: build xfade video (no audio)
  if (clips.length === 1) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg().input(clips[0]).videoCodec('copy').noAudio().output(silentOut)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`XFade copy: ${e.message}`))).run();
    });
  } else {
    const filterParts: string[] = [];
    let prevLabel = '[0:v]';

    for (let i = 0; i < clips.length - 1; i++) {
      const transition = transitions[i] ?? 'fade';
      // Offset formula for chained xfades: each step the output timeline shrinks by one transition
      const offset   = (i + 1) * clipDuration - (i + 1) * transitionDuration;
      const isLast   = i === clips.length - 2;
      const outLabel = isLast ? '[vout]' : `[v${i}]`;
      filterParts.push(
        `${prevLabel}[${i + 1}:v]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset.toFixed(3)}${outLabel}`,
      );
      prevLabel = outLabel;
    }

    // fluent-ffmpeg spawns ffmpeg without a shell, so the raw filter string
    // (brackets, semicolons) reaches -filter_complex unquoted and unescaped.
    // Write it to a file and use -filter_complex_script instead, same pattern
    // as concatWithAudio's concat list file.
    const filterScriptPath = path.join(tmpDir, `_tmp_xfade_filter_${Date.now()}.txt`);
    fs.writeFileSync(filterScriptPath, filterParts.join(';'));

    const cleanupFilterScript = () => {
      try { if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath); } catch { /* ignore */ }
    };

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      clips.forEach(c => cmd.input(c));
      logger.error(`[XFADE DEBUG] filterParts: ${JSON.stringify(filterParts)}`);
      logger.error(`[XFADE DEBUG] joined filter: ${filterParts.join(';')}`);
      logger.error(`[XFADE DEBUG] clips array: ${JSON.stringify(clips)}`);
      cmd
        .outputOptions([
          '-filter_complex_script', filterScriptPath,
          '-map', '[vout]',
          '-preset fast', '-crf 22', '-pix_fmt yuv420p',
        ])
        .videoCodec('libx264')
        .noAudio()
        .output(silentOut)
        .on('start', (c: string) => logger.error(`[FFmpeg xfade FULL CMD] ${c}`))
        .on('end', () => { cleanupFilterScript(); resolve(); })
        .on('error', (e: Error) => { cleanupFilterScript(); reject(new Error(`XFade concat: ${e.message}`)); }).run();
    });
  }

  // Step 2: mux audio
  const totalDuration = clips.length * clipDuration - (clips.length - 1) * transitionDuration;
  if (audioPath && fs.existsSync(audioPath)) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(silentOut)
        .input(audioPath)
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate(128)
        .audioFilter(`afade=t=out:st=${(totalDuration - 1.5).toFixed(2)}:d=1.5`)
        .outputOptions(['-shortest'])
        .output(output)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`XFade mux: ${e.message}`))).run();
    });
    try { fs.unlinkSync(silentOut); } catch { /* ignore */ }
  } else {
    fs.renameSync(silentOut, output);
  }
}

// ── Audio ──────────────────────────────────────────────────────────────────

async function prepareAudio(outputPath: string, duration: number): Promise<void> {
  if (fs.existsSync(BUNDLED_MUSIC)) {
    logger.info('[ContentGen] Using bundled music track…');
    return processRealAudio(BUNDLED_MUSIC, outputPath, duration);
  }
  logger.warn('[ContentGen] Bundled music not found — generating synthetic pad');
  return buildSyntheticAudio(outputPath, duration);
}

function processRealAudio(inputMp3: string, outputPath: string, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputMp3)
      .audioFilter(`afade=t=in:st=0:d=2,afade=t=out:st=${duration - 2}:d=2,volume=0.4`)
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .outputOptions([`-t ${duration}`])
      .output(outputPath)
      .on('end',   () => resolve())
      .on('error', (e: Error) => reject(new Error(`Audio real: ${e.message}`)))
      .run();
  });
}

function buildSyntheticAudio(outputPath: string, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const chord = [
      '0.30*sin(2*PI*261*t)',
      '0.22*sin(2*PI*329*t)',
      '0.18*sin(2*PI*392*t)',
      '0.10*sin(2*PI*523*t)',
    ].join('+');
    const expr = `(0.95+0.05*sin(2*PI*0.25*t))*(${chord})`;

    ffmpeg()
      .input(`aevalsrc=${expr}:s=44100:d=${duration}`)
      .inputOptions(['-f lavfi'])
      .audioFilter(`afade=t=in:st=0:d=2,afade=t=out:st=${duration - 2}:d=2,volume=0.45`)
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .output(outputPath)
      .on('end',   () => resolve())
      .on('error', (e: Error) => reject(new Error(`Audio synth: ${e.message}`)))
      .run();
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '').padEnd(6, '0');
  return {
    r: parseInt(c.slice(0, 2), 16) || 0,
    g: parseInt(c.slice(2, 4), 16) || 0,
    b: parseInt(c.slice(4, 6), 16) || 0,
  };
}

function clamp(n: number): number { return Math.min(255, Math.max(0, Math.round(n))); }

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wordWrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
