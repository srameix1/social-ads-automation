import fs   from 'fs';
import path from 'path';
import { query, queryOne } from '../../config/database';
import {
  generateVisualVariations,
  generateVisualVariationsFromPhotos,
  generateProfessionalVideosFromImage,
  generatePremiumVideoFromImage,
  generatePremiumReelFromImage,
  ContentInput,
} from '../../services/contentGeneration.service';
import { logger } from '../../utils/logger';
import { env }    from '../../config/env';

interface Post {
  id:             string;
  campaign_id:    string;
  format:         'image' | 'animated_video' | 'reel';
  problem:        string | null;
  differentiator: string | null;
}

interface Strategy {
  id:             string;
  copy_text:      string;
  visual_concept: string;
}

interface ClientProfile {
  plan:                  string | null;
  business_name:         string | null;
  brand_primary_color:   string | null;
  brand_secondary_color: string | null;
  brand_logo_url:        string | null;
}

export async function generateVisualsForPost(
  post:          Post,
  strategy:      Strategy,
  clientId:      string,
  photoBuffers?: Buffer[],
): Promise<void> {
  logger.info(`[Strategy] Generando visuales para post ${post.id} — format: ${post.format}`);
  try {
    const clientProfile = await loadClientProfile(clientId);
    const logoBuffer    = clientProfile.brand_logo_url
      ? await loadLogoAsBuffer(clientProfile.brand_logo_url)
      : undefined;

    const contentInput: ContentInput = {
      businessName:   clientProfile.business_name ?? 'Negocio',
      description:    [post.problem, post.differentiator].filter(Boolean).join(' ') || undefined,
      visualConcept:  strategy.visual_concept,
      copyText:       strategy.copy_text,
      primaryColor:   clientProfile.brand_primary_color   ?? '#1A1A1A',
      secondaryColor: clientProfile.brand_secondary_color ?? undefined,
      logoBuffer,
      clientPhotos:   [],
      outputDir:      '',
      campaignId:     post.id,
    };

    const variationsDir = path.resolve(env.UPLOADS_DIR, 'variations', post.id);
    const plan          = clientProfile.plan ?? 'basic';

    const variations = photoBuffers?.length
      ? await generateVisualVariationsFromPhotos(photoBuffers, contentInput, variationsDir, plan)
      : await generateVisualVariations(contentInput, variationsDir);

    const rows = await query<{ id: string; position: number }>(
      'SELECT id, position FROM visual_variations WHERE post_id = $1 ORDER BY position',
      [post.id],
    );

    for (const row of rows) {
      const v = variations[row.position - 1];
      if (!v) continue;
      const url = filePathToUrl(v.path);
      await query(
        `UPDATE visual_variations
            SET url = $1, status = 'ready', visual_concept_variant = $2, type = $3
          WHERE id = $4`,
        [url, v.visualConceptVariant, v.type, row.id],
      );
    }

    await query(
      `UPDATE posts
       SET workflow_status = 'visuals_ready', visual_generation_attempts = visual_generation_attempts + 1
       WHERE id = $1`,
      [post.id],
    );
    logger.info(`[Strategy] Visuales listos — post ${post.id}`);

  } catch (err) {
    logger.error('[Strategy] Error generando visuales:', err);
    await query(
      "UPDATE posts SET workflow_status = 'visuals_failed' WHERE id = $1",
      [post.id],
    );
    await query(
      "UPDATE visual_variations SET status = 'failed' WHERE post_id = $1",
      [post.id],
    );
  }
}

export async function generateVideoForSelectedVariation(
  postId:      string,
  variationId: string,
  imageUrl:    string,
  format:      'animated_video' | 'reel',
  outputDir:   string,
): Promise<void> {
  logger.info(`[Strategy] Generando video ${format} desde variación ${variationId}`);
  try {
    const match = imageUrl.match(/\/uploads\/(.+)$/);
    if (!match) throw new Error(`URL de imagen inválida: ${imageUrl}`);
    const imagePath = path.join(path.resolve(env.UPLOADS_DIR), match[1]);
    if (!fs.existsSync(imagePath)) throw new Error(`Imagen no encontrada: ${imagePath}`);

    let videoUrl: string;
    if (format === 'animated_video') {
      const contentInput = await buildContentInputForPost(postId, variationId);
      const { feed } = await generateProfessionalVideosFromImage(imagePath, outputDir, contentInput ?? undefined);
      videoUrl = filePathToUrl(feed);
    } else if (format === 'reel') {
      const contentInput = await buildContentInputForPost(postId, variationId);
      const { video } = await generatePremiumVideoFromImage(imagePath, outputDir, contentInput ?? undefined);
      videoUrl = filePathToUrl(video);
    } else {
      // Safety fallback for any unexpected format value — mixed reel (proven, still in use elsewhere)
      const contentInput = await buildContentInputForPost(postId, variationId);
      const { reel } = await generatePremiumReelFromImage(imagePath, outputDir, contentInput ?? undefined);
      videoUrl = filePathToUrl(reel);
    }

    await query(
      `UPDATE visual_variations SET url = $1, type = 'video' WHERE id = $2`,
      [videoUrl, variationId],
    );
    await query(
      "UPDATE posts SET workflow_status = 'visual_selected' WHERE id = $1",
      [postId],
    );
    logger.info(`[Strategy] Video ${format} listo — variación ${variationId}`);
  } catch (err) {
    logger.error('[Strategy] Error generando video:', err);
    await query(
      "UPDATE posts SET workflow_status = 'visual_selected' WHERE id = $1",
      [postId],
    );
  }
}

async function buildContentInputForPost(postId: string, variationId?: string): Promise<ContentInput | null> {
  const row = await queryOne<{
    problem:                   string | null;
    differentiator:            string | null;
    post_focus:                string | null;
    campaign_id:               string;
    copy_text:                 string | null;
    visual_concept:            string | null;
    business_name:             string | null;
    campaign_business_problem: string | null;
    campaign_differentiator:   string | null;
    primary_color:             string | null;
    secondary_color:           string | null;
    brand_logo_url:            string | null;
  }>(
    `SELECT p.problem, p.differentiator, p.post_focus, p.campaign_id,
            s.copy_text, s.visual_concept,
            cp.business_name,
            c.business_problem AS campaign_business_problem,
            c.differentiator   AS campaign_differentiator,
            cp.brand_primary_color   AS primary_color,
            cp.brand_secondary_color AS secondary_color,
            cp.brand_logo_url
     FROM posts p
     LEFT JOIN strategies s ON s.id = p.strategy_id
     JOIN campaigns c ON c.id = p.campaign_id
     JOIN client_profiles cp ON cp.user_id = c.client_id
     WHERE p.id = $1`,
    [postId],
  );

  if (!row) return null;

  const logoBuffer = row.brand_logo_url
    ? await loadLogoAsBuffer(row.brand_logo_url)
    : undefined;

  // Prefer campaign-level business context over the old per-post fields
  const descParts = [
    row.campaign_business_problem ?? row.problem,
    row.campaign_differentiator   ?? row.differentiator,
  ].filter(Boolean);

  // Fold in the selected variation's visual_concept_variant (e.g. "ai-bold"),
  // if any, so a clean regeneration of its scene stays close to what the
  // client actually picked — same fallback chain used for media_assets.prompt_used.
  let visualConcept = row.visual_concept ?? undefined;
  if (variationId) {
    const variation = await queryOne<{ visual_concept_variant: string | null }>(
      'SELECT visual_concept_variant FROM visual_variations WHERE id = $1',
      [variationId],
    );
    if (variation?.visual_concept_variant) {
      visualConcept = [visualConcept, variation.visual_concept_variant].filter(Boolean).join('. ');
    }
  }

  return {
    businessName:   row.business_name  ?? 'Negocio',
    description:    descParts.join(' ') || undefined,
    postFocus:      row.post_focus      ?? undefined,
    visualConcept,
    copyText:       row.copy_text       ?? '',
    primaryColor:   row.primary_color   ?? '#1A1A1A',
    secondaryColor: row.secondary_color ?? undefined,
    logoBuffer,
    clientPhotos:   [],
    outputDir:      '',
    campaignId:     row.campaign_id,
  };
}

async function loadClientProfile(clientId: string): Promise<ClientProfile> {
  return await queryOne<ClientProfile>(
    `SELECT plan, business_name,
            brand_primary_color, brand_secondary_color, brand_logo_url
     FROM client_profiles WHERE user_id = $1`,
    [clientId],
  ) ?? {
    plan: null, business_name: null,
    brand_primary_color: null, brand_secondary_color: null, brand_logo_url: null,
  };
}

async function loadLogoAsBuffer(logoUrl: string): Promise<Buffer | undefined> {
  try {
    const match = logoUrl.match(/\/uploads\/(.+)$/);
    if (!match) return undefined;
    const filePath = path.join(path.resolve(env.UPLOADS_DIR), match[1]);
    if (!fs.existsSync(filePath)) return undefined;
    return fs.readFileSync(filePath);
  } catch (err) {
    logger.warn('[Strategy] No se pudo cargar logo:', (err as Error).message);
    return undefined;
  }
}

function filePathToUrl(absolutePath: string): string {
  const relative = path.relative(path.resolve(env.UPLOADS_DIR), absolutePath).replace(/\\/g, '/');
  return `/uploads/${relative}`;
}
