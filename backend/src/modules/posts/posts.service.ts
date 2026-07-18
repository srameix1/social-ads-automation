import fs   from 'fs';
import path from 'path';
import { query, queryOne, withTransaction } from '../../config/database';
import { createError } from '../../middleware/errorHandler';
import { generateAdStrategiesForPost } from '../../services/claude.service';
import { generateVisualsForPost, generateVideoForSelectedVariation } from '../strategies/strategies.service';
import { applyVideoOverlays } from '../../services/contentGeneration.service';
import { publishToSocialMedia } from '../variations/variations.service';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { PoolClient } from 'pg';

export type PostStatus    = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type PostFormat    = 'image' | 'animated_video' | 'reel';
export type WorkflowStatus =
  | 'draft' | 'described' | 'generating_copy' | 'copy_ready'
  | 'generating_visuals' | 'visuals_ready' | 'visuals_failed'
  | 'visual_selected' | 'generating_video' | 'confirmed';

export interface Post {
  id:                  string;
  campaign_id:         string;
  strategy_id:         string | null;
  visual_variation_id: string | null;
  scheduled_date:      string | null;
  status:              PostStatus;
  platforms:           string[];
  platform:            string;
  format:              PostFormat;
  post_focus:          string | null;
  problem:             string | null;
  differentiator:      string | null;
  ideal_client:        string | null;
  concrete_result:     string | null;
  client_pain:         string | null;
  workflow_status:     WorkflowStatus;
  overlay_logo:        boolean;
  overlay_copy:        boolean;
  copy_generation_attempts:   number;
  visual_generation_attempts: number;
  published_at:        string | null;
  error_message:       string | null;
  created_at:          string;
  updated_at:          string;
}

interface Strategy {
  id:             string;
  post_id:        string;
  title:          string;
  description:    string;
  copy_text:      string;
  visual_concept: string;
  tone:           string | null;
  target_hook:    string | null;
  position:       number;
  selected:       boolean;
}

interface VisualVariation {
  id:                    string;
  post_id:               string;
  strategy_id:           string | null;
  position:              number;
  url:                   string | null;
  type:                  string;
  status:                string;
  visual_concept_variant: string | null;
  selected:              boolean;
}

export interface PostWithDetails extends Post {
  strategies: Strategy[];
  variations: VisualVariation[];
}

// ── List ───────────────────────────────────────────────────────────────────

export async function listPosts(campaignId: string, clientId: string): Promise<Post[]> {
  const [cam] = await query<{ id: string }>(
    'SELECT id FROM campaigns WHERE id = $1 AND client_id = $2',
    [campaignId, clientId],
  );
  if (!cam) throw createError('Campaña no encontrada', 404);

  return query<Post>(
    `SELECT p.*,
       (SELECT url FROM visual_variations WHERE post_id = p.id AND selected = TRUE LIMIT 1) AS selected_visual_url
     FROM posts p
     WHERE p.campaign_id = $1
     ORDER BY p.scheduled_date ASC NULLS LAST, p.created_at DESC`,
    [campaignId],
  );
}

// ── Create (Step 0) ────────────────────────────────────────────────────────

export async function createPost(
  campaignId: string,
  clientId:   string,
  data: {
    platforms:       string[];
    format?:         PostFormat;
    scheduled_date?: string;
  },
): Promise<Post> {
  const [cam] = await query<{
    id:                 string;
    max_posts:          number;
    posts_used:         string;
    is_trial:           boolean;
    trial_posts_used:   number;
    trial_posts_limit:  number;
    courtesy_active:    boolean;
  }>(
    `SELECT campaigns.id, campaigns.max_posts,
       (SELECT COUNT(*)::int FROM posts WHERE campaign_id = campaigns.id) AS posts_used,
       cp.is_trial, cp.posts_used AS trial_posts_used, cp.trial_posts_limit,
       (cp.is_courtesy AND cp.courtesy_expires_at > NOW()) AS courtesy_active
     FROM campaigns
     JOIN client_profiles cp ON cp.user_id = campaigns.client_id
     WHERE campaigns.id = $1 AND campaigns.client_id = $2`,
    [campaignId, clientId],
  );
  if (!cam) throw createError('Campaña no encontrada', 404);
  // Cortesía activa: acceso completo sin límite de posts, salta ambos topes.
  if (!cam.courtesy_active) {
    if (parseInt(cam.posts_used) >= cam.max_posts) {
      throw createError(`Has alcanzado el límite de tu plan (${cam.max_posts}/${cam.max_posts})`, 403);
    }
    if (cam.is_trial && cam.trial_posts_used >= cam.trial_posts_limit) {
      throw createError(
        `Has alcanzado el límite de tu período de prueba (${cam.trial_posts_used}/${cam.trial_posts_limit})`,
        403,
        'TRIAL_LIMIT_REACHED',
      );
    }
  }

  if (!data.platforms?.length) throw createError('Selecciona al menos una plataforma', 400);

  const format: PostFormat = data.format ?? 'image';
  const validFormats: PostFormat[] = ['image', 'animated_video', 'reel'];
  if (!validFormats.includes(format)) throw createError('Formato inválido', 400);

  const [post] = await query<Post>(
    `INSERT INTO posts (campaign_id, platforms, format, scheduled_date)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [campaignId, data.platforms, format, data.scheduled_date ?? null],
  );

  if (cam.is_trial) {
    await query('UPDATE client_profiles SET posts_used = posts_used + 1 WHERE user_id = $1', [clientId]);
  }

  return post;
}

// ── Get post with details (polling) ───────────────────────────────────────

export async function getPost(postId: string, clientId: string): Promise<PostWithDetails> {
  const post = await queryOne<Post>(
    `SELECT p.* FROM posts p
     JOIN campaigns c ON c.id = p.campaign_id
     WHERE p.id = $1 AND c.client_id = $2`,
    [postId, clientId],
  );
  if (!post) throw createError('Anuncio no encontrado', 404);

  const [strategies, variations] = await Promise.all([
    query<Strategy>(
      'SELECT * FROM strategies WHERE post_id = $1 ORDER BY position',
      [postId],
    ),
    query<VisualVariation>(
      'SELECT * FROM visual_variations WHERE post_id = $1 ORDER BY position',
      [postId],
    ),
  ]);

  return { ...post, strategies, variations };
}

// ── Update description (Step 1) ────────────────────────────────────────────

export async function updateDescription(
  postId:   string,
  clientId: string,
  data: {
    post_focus?:     string;
    // Legacy fields kept for backward compat (old campaigns without business profile)
    problem?:        string;
    differentiator?: string;
    ideal_client?:   string;
    concrete_result?: string;
    client_pain?:    string;
  },
): Promise<Post> {
  const [existing] = await query<{ id: string }>(
    `SELECT p.id FROM posts p
     JOIN campaigns c ON c.id = p.campaign_id
     WHERE p.id = $1 AND c.client_id = $2`,
    [postId, clientId],
  );
  if (!existing) throw createError('Anuncio no encontrado', 404);

  const [updated] = await query<Post>(
    `UPDATE posts
     SET post_focus      = COALESCE($1, post_focus),
         problem         = COALESCE($2, problem),
         differentiator  = COALESCE($3, differentiator),
         ideal_client    = COALESCE($4, ideal_client),
         concrete_result = COALESCE($5, concrete_result),
         client_pain     = COALESCE($6, client_pain),
         workflow_status = 'described'
     WHERE id = $7
     RETURNING *`,
    [
      data.post_focus     ?? null,
      data.problem        ?? null,
      data.differentiator ?? null,
      data.ideal_client   ?? null,
      data.concrete_result ?? null,
      data.client_pain    ?? null,
      postId,
    ],
  );
  return updated;
}

// ── Generate copy options (Step 1 → 2) ────────────────────────────────────

type PostWithCampaignContext = Post & {
  business_name:            string;
  campaign_business_problem: string | null;
  campaign_differentiator:   string | null;
  campaign_ideal_client:     string | null;
  campaign_concrete_result:  string | null;
  campaign_client_pain:      string | null;
  max_copy_attempts:         number;
};

export async function generateCopyOptions(
  postId:   string,
  clientId: string,
  lang?:    string,
): Promise<{ post: Post; strategies: Strategy[] }> {
  const postWithBiz = await queryOne<PostWithCampaignContext>(
    `SELECT p.*, cp.business_name,
       c.business_problem AS campaign_business_problem,
       c.differentiator   AS campaign_differentiator,
       c.ideal_client     AS campaign_ideal_client,
       c.concrete_result  AS campaign_concrete_result,
       c.client_pain      AS campaign_client_pain,
       COALESCE(pl.max_copy_attempts, 5) AS max_copy_attempts
     FROM posts p
     JOIN campaigns c        ON c.id  = p.campaign_id
     JOIN client_profiles cp ON cp.user_id = c.client_id
     LEFT JOIN plan_limits pl ON pl.plan = cp.plan
     WHERE p.id = $1 AND c.client_id = $2`,
    [postId, clientId],
  );
  if (!postWithBiz) throw createError('Anuncio no encontrado', 404);

  const hasCampaignProfile = !!(postWithBiz.campaign_business_problem);
  const hasPostFocus       = !!(postWithBiz.post_focus);
  const hasLegacyFields    = !!(postWithBiz.problem);

  if (!hasCampaignProfile && !hasPostFocus && !hasLegacyFields) {
    throw createError('Completa la descripción del anuncio primero', 400);
  }

  if (postWithBiz.copy_generation_attempts >= postWithBiz.max_copy_attempts) {
    throw createError(
      `Has alcanzado el límite de generaciones de copy de tu plan (${postWithBiz.max_copy_attempts}/${postWithBiz.max_copy_attempts})`,
      403,
      'COPY_LIMIT_REACHED',
    );
  }

  await query("UPDATE posts SET workflow_status = 'generating_copy' WHERE id = $1", [postId]);

  let strategies: Strategy[];
  try {
    const claudeInput = hasCampaignProfile
      ? {
          businessName: postWithBiz.business_name || 'Negocio',
          platforms:    postWithBiz.platforms,
          campaignContext: {
            businessProblem: postWithBiz.campaign_business_problem!,
            differentiator:  postWithBiz.campaign_differentiator  ?? '',
            idealClient:     postWithBiz.campaign_ideal_client    ?? '',
            concreteResult:  postWithBiz.campaign_concrete_result ?? '',
            clientPain:      postWithBiz.campaign_client_pain     ?? '',
          },
          postFocus: postWithBiz.post_focus ?? '',
          lang,
        }
      : {
          businessName:   postWithBiz.business_name || 'Negocio',
          platforms:      postWithBiz.platforms,
          problem:        postWithBiz.problem        ?? postWithBiz.post_focus ?? '',
          differentiator: postWithBiz.differentiator ?? '',
          idealClient:    postWithBiz.ideal_client   ?? '',
          concreteResult: postWithBiz.concrete_result ?? '',
          clientPain:     postWithBiz.client_pain    ?? '',
          lang,
        };

    const drafts = await generateAdStrategiesForPost(claudeInput);

    logger.info(`[Posts] Claude devolvió ${drafts.length} estrategias para post ${postId}`);

    strategies = await withTransaction(async (dbClient: PoolClient): Promise<Strategy[]> => {
      // Delete any prior strategies for this post (allow regeneration)
      await dbClient.query('DELETE FROM strategies WHERE post_id = $1', [postId]);

      const saved: Strategy[] = [];
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const [s] = await dbClient.query<Strategy>(
          `INSERT INTO strategies
             (post_id, title, description, copy_text, visual_concept, tone, target_hook, video_hook, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [postId, d.title, d.description, d.copy_text, d.visual_concept, d.tone, d.target_hook, d.video_hook, i + 1],
        ).then(r => r.rows);
        saved.push(s);
      }
      await dbClient.query(
        `UPDATE posts
         SET workflow_status = 'copy_ready', copy_generation_attempts = copy_generation_attempts + 1
         WHERE id = $1`,
        [postId],
      );
      return saved;
    });
  } catch (err) {
    await query("UPDATE posts SET workflow_status = 'described' WHERE id = $1", [postId]);
    throw err;
  }

  const updatedPost = await queryOne<Post>('SELECT * FROM posts WHERE id = $1', [postId]);
  return { post: updatedPost!, strategies };
}

// ── Select copy option (Step 2 → 3) ───────────────────────────────────────

export async function selectCopyOption(
  postId:     string,
  clientId:   string,
  strategyId: string,
): Promise<Post> {
  return doSelectCopy(postId, clientId, strategyId);
}

export async function selectCopyWithPhotos(
  postId:       string,
  clientId:     string,
  strategyId:   string,
  photoBuffers: Buffer[],
): Promise<Post> {
  return doSelectCopy(postId, clientId, strategyId, photoBuffers);
}

async function doSelectCopy(
  postId:        string,
  clientId:      string,
  strategyId:    string,
  photoBuffers?: Buffer[],
): Promise<Post> {
  const { post, strategy } = await withTransaction(async (dbClient: PoolClient) => {
    const postRow = await dbClient.query<Post & { max_visual_attempts: number }>(
      `SELECT p.*, COALESCE(pl.max_visual_attempts, 2) AS max_visual_attempts
       FROM posts p
       JOIN campaigns c        ON c.id = p.campaign_id
       JOIN client_profiles cp ON cp.user_id = c.client_id
       LEFT JOIN plan_limits pl ON pl.plan = cp.plan
       WHERE p.id = $1 AND c.client_id = $2`,
      [postId, clientId],
    ).then(r => r.rows[0]);
    if (!postRow) throw createError('Anuncio no encontrado', 404);

    if (postRow.visual_generation_attempts >= postRow.max_visual_attempts) {
      throw createError(
        `Has alcanzado el límite de generaciones de imágenes de tu plan (${postRow.max_visual_attempts}/${postRow.max_visual_attempts})`,
        403,
        'VISUAL_LIMIT_REACHED',
      );
    }

    const strategyRow = await dbClient.query<Strategy>(
      'SELECT * FROM strategies WHERE id = $1 AND post_id = $2',
      [strategyId, postId],
    ).then(r => r.rows[0]);
    if (!strategyRow) throw createError('Estrategia no encontrada', 404);

    // Deselect any previous selection, select the chosen one
    await dbClient.query('UPDATE strategies SET selected = FALSE WHERE post_id = $1', [postId]);
    await dbClient.query('UPDATE strategies SET selected = TRUE WHERE id = $1', [strategyId]);

    // Remove any prior variation slots
    await dbClient.query('DELETE FROM visual_variations WHERE post_id = $1', [postId]);

    // Create 4 generating slots
    for (let pos = 1; pos <= 4; pos++) {
      await dbClient.query(
        `INSERT INTO visual_variations (post_id, strategy_id, position, status, type)
         VALUES ($1, $2, $3, 'generating', 'image')`,
        [postId, strategyId, pos],
      );
    }

    const [updatedPost] = await dbClient.query<Post>(
      `UPDATE posts SET workflow_status = 'generating_visuals', strategy_id = $1
       WHERE id = $2 RETURNING *`,
      [strategyId, postId],
    ).then(r => r.rows);

    return { post: updatedPost, strategy: strategyRow };
  });

  setImmediate(async () => {
    try {
      await generateVisualsForPost(post, strategy, clientId, photoBuffers);
    } catch (err) {
      const msg = (err as Error).message ?? 'Error desconocido generando visuales';
      logger.error(`[doSelectCopy] Visual generation failed for post ${post.id}: ${msg}`);
      await query(
        `UPDATE posts SET workflow_status = 'visuals_failed', error_message = $1 WHERE id = $2`,
        [msg.slice(0, 500), post.id],
      ).catch((dbErr: unknown) =>
        logger.error(`[doSelectCopy] Could not mark post as failed: ${(dbErr as Error).message}`),
      );
    }
  });
  return post;
}

// ── Select visual (Step 3 → 4) ────────────────────────────────────────────

export async function selectVisual(
  postId:      string,
  clientId:    string,
  variationId: string,
): Promise<Post> {
  const post = await queryOne<Post>(
    `SELECT p.* FROM posts p
     JOIN campaigns c ON c.id = p.campaign_id
     WHERE p.id = $1 AND c.client_id = $2`,
    [postId, clientId],
  );
  if (!post) throw createError('Anuncio no encontrado', 404);

  const variation = await queryOne<{ id: string; url: string | null; position: number; type: string }>(
    'SELECT id, url, position, type FROM visual_variations WHERE id = $1 AND post_id = $2',
    [variationId, postId],
  );
  if (!variation) throw createError('Variación no encontrada', 404);

  await query('UPDATE visual_variations SET selected = FALSE WHERE post_id = $1', [postId]);
  await query('UPDATE visual_variations SET selected = TRUE WHERE id = $1', [variationId]);

  const needsVideo = post.format !== 'image' && !!variation.url;
  const newStatus: WorkflowStatus = needsVideo ? 'generating_video' : 'visual_selected';

  const [updated] = await query<Post>(
    `UPDATE posts SET visual_variation_id = $1, workflow_status = $2
     WHERE id = $3 RETURNING *`,
    [variationId, newStatus, postId],
  );

  if (needsVideo) {
    const outputDir = path.resolve(env.UPLOADS_DIR, 'variations', postId);

    // On retry the variation.url already points to the previously-generated .mp4.
    // The original JPG (variation_N.jpg) is still on disk — use it instead.
    let imageUrlForVideo = variation.url!;
    if (variation.type === 'video' || imageUrlForVideo.endsWith('.mp4')) {
      const originalJpg = path.join(outputDir, `variation_${variation.position}.jpg`);
      if (fs.existsSync(originalJpg)) {
        imageUrlForVideo = `/uploads/variations/${postId}/variation_${variation.position}.jpg`;
        logger.info(`[selectVisual] Retry detected — using original image: ${originalJpg}`);
      } else {
        logger.warn(`[selectVisual] Retry: original image not found at ${originalJpg}, will use current url`);
      }
    }

    setImmediate(async () => {
      try {
        await generateVideoForSelectedVariation(
          postId,
          variationId,
          imageUrlForVideo,
          post.format as 'animated_video' | 'reel',
          outputDir,
        );
      } catch (err) {
        const msg = (err as Error).message ?? 'Error desconocido generando video';
        logger.error(`[selectVisual] Video generation failed for post ${postId}: ${msg}`);
        await query(
          `UPDATE posts SET workflow_status = 'visuals_failed', error_message = $1 WHERE id = $2`,
          [msg.slice(0, 500), postId],
        ).catch((dbErr: unknown) =>
          logger.error(`[selectVisual] Could not mark post as failed: ${(dbErr as Error).message}`),
        );
      }
    });
  }

  return updated;
}

// ── Confirm post (Step 4) ──────────────────────────────────────────────────

export async function confirmPost(
  postId:      string,
  clientId:    string,
  overlayLogo: boolean,
  overlayCopy: boolean,
): Promise<{ post: Post; variationUrl: string | null }> {
  logger.info(`[confirmPost] postId=${postId} overlayLogo=${overlayLogo} overlayCopy=${overlayCopy}`);

  const [existing] = await query<{ id: string }>(
    `SELECT p.id FROM posts p
     JOIN campaigns c ON c.id = p.campaign_id
     WHERE p.id = $1 AND c.client_id = $2`,
    [postId, clientId],
  );
  if (!existing) throw createError('Anuncio no encontrado', 404);

  let variationUrl: string | null = null;
  if (overlayLogo || overlayCopy) {
    try {
      variationUrl = await applyOverlaysToPost(postId, overlayLogo, overlayCopy);
    } catch (err) {
      logger.error(`[confirmPost] Overlay failed for post ${postId}: ${(err as Error).message}`);
    }
  }

  const [post] = await query<Post>(
    `UPDATE posts SET workflow_status = 'confirmed', status = 'scheduled',
                      overlay_logo = $2, overlay_copy = $3
     WHERE id = $1 RETURNING *`,
    [postId, overlayLogo, overlayCopy],
  );

  const clientProfile = await queryOne<{ delivery_mode: string | null }>(
    'SELECT delivery_mode FROM client_profiles WHERE user_id = $1',
    [clientId],
  );

  if (clientProfile?.delivery_mode === 'automatic') {
    setImmediate(() => publishConfirmedPost(post, clientId, variationUrl));
  }

  return { post, variationUrl };
}

// ── Auto-publish a confirmed post (delivery_mode = 'automatic') ───────────

async function publishConfirmedPost(
  post:         Post,
  clientId:     string,
  variationUrl: string | null,
): Promise<void> {
  let mediaUrl = variationUrl;
  if (!mediaUrl) {
    const variation = await queryOne<{ url: string | null }>(
      'SELECT url FROM visual_variations WHERE id = $1',
      [post.visual_variation_id],
    );
    mediaUrl = variation?.url ?? null;
  }
  if (!mediaUrl) {
    logger.error(`[publishConfirmedPost] No hay media URL para post ${post.id}, se aborta publicación automática`);
    return;
  }

  if (!post.strategy_id) {
    logger.error(`[publishConfirmedPost] Post ${post.id} no tiene strategy_id, se aborta publicación automática`);
    return;
  }

  const strategy = await queryOne<{ copy_text: string }>(
    'SELECT copy_text FROM strategies WHERE id = $1',
    [post.strategy_id],
  );
  const copyText = strategy?.copy_text ?? '';

  for (const platform of post.platforms) {
    try {
      logger.info(`[publishConfirmedPost] Publicando post ${post.id} en ${platform}`);
      await publishToSocialMedia(
        platform, clientId, mediaUrl, copyText,
        post.campaign_id, post.strategy_id, null,
      );
      logger.info(`[publishConfirmedPost] Post ${post.id} publicado en ${platform}`);
    } catch (err) {
      logger.error(`[publishConfirmedPost] Error publicando post ${post.id} en ${platform}: ${(err as Error).message}`);
    }
  }
}

async function applyOverlaysToPost(
  postId:      string,
  overlayLogo: boolean,
  overlayCopy: boolean,
): Promise<string | null> {
  const row = await queryOne<{
    variation_id:   string | null;
    variation_url:  string | null;
    variation_type: string | null;
    copy_text:      string | null;
    video_hook:     string | null;
    brand_logo_url: string | null;
  }>(
    `SELECT vv.id AS variation_id, vv.url AS variation_url, vv.type AS variation_type,
            s.copy_text, s.video_hook, cp.brand_logo_url
     FROM posts p
     LEFT JOIN visual_variations vv ON vv.id = p.visual_variation_id
     LEFT JOIN strategies s         ON s.id  = p.strategy_id
     JOIN  campaigns c              ON c.id  = p.campaign_id
     JOIN  client_profiles cp       ON cp.user_id = c.client_id
     WHERE p.id = $1`,
    [postId],
  );

  if (!row?.variation_id || !row.variation_url || row.variation_type !== 'video') return null;

  const match = row.variation_url.match(/\/uploads\/(.+)$/);
  if (!match) return null;

  const uploadsDir = path.resolve(env.UPLOADS_DIR);
  const videoPath  = path.join(uploadsDir, match[1]);
  if (!fs.existsSync(videoPath)) {
    logger.warn(`[applyOverlaysToPost] Video not found: ${videoPath}`);
    return null;
  }

  // Always work from the original (non-overlaid) video.
  // If the DB URL already points to a _overlaid.mp4 (re-confirm case),
  // strip the suffix and use the original source file instead.
  const ext     = path.extname(videoPath);
  const rawBase = path.basename(videoPath, ext).replace(/_overlaid$/, '');
  const sourceDir  = path.dirname(videoPath);
  const sourcePath = path.join(sourceDir, `${rawBase}${ext}`);
  const outputPath = path.join(sourceDir, `${rawBase}_overlaid${ext}`);

  const inputPath = fs.existsSync(sourcePath) ? sourcePath : videoPath;
  if (inputPath !== videoPath) {
    logger.info(`[applyOverlaysToPost] Re-confirm detected — using original: ${path.basename(sourcePath)}`);
  }

  let logoPath: string | null = null;
  if (overlayLogo && row.brand_logo_url) {
    const logoMatch = row.brand_logo_url.match(/\/uploads\/(.+)$/);
    if (logoMatch) {
      const logoFilePath = path.join(uploadsDir, logoMatch[1]);
      if (fs.existsSync(logoFilePath)) logoPath = logoFilePath;
    }
  }

  await applyVideoOverlays(inputPath, row.video_hook ?? row.copy_text ?? '', logoPath, overlayLogo, overlayCopy, outputPath);

  const newUrl = `/uploads/${path.relative(uploadsDir, outputPath).replace(/\\/g, '/')}`;
  await query('UPDATE visual_variations SET url = $1 WHERE id = $2', [newUrl, row.variation_id]);
  logger.info(`[applyOverlaysToPost] Updated variation ${row.variation_id} → ${newUrl}`);
  return newUrl;
}

// ── Update (legacy PATCH) ──────────────────────────────────────────────────

export async function updatePost(
  postId:     string,
  campaignId: string,
  clientId:   string,
  data: Partial<{
    scheduled_date:      string;
    status:              PostStatus;
    platform:            string;
    visual_variation_id: string;
    format:              PostFormat;
  }>,
): Promise<Post> {
  const [existing] = await query<{ id: string }>(
    `SELECT p.id FROM posts p
     JOIN campaigns c ON c.id = p.campaign_id
     WHERE p.id = $1 AND p.campaign_id = $2 AND c.client_id = $3`,
    [postId, campaignId, clientId],
  );
  if (!existing) throw createError('Post no encontrado', 404);

  const fields: string[] = [];
  const values: unknown[] = [];
  let   i = 1;

  if (data.scheduled_date      !== undefined) { fields.push(`scheduled_date = $${i++}`);      values.push(data.scheduled_date); }
  if (data.status              !== undefined) { fields.push(`status = $${i++}`);              values.push(data.status); }
  if (data.platform            !== undefined) { fields.push(`platform = $${i++}`);            values.push(data.platform); }
  if (data.visual_variation_id !== undefined) { fields.push(`visual_variation_id = $${i++}`); values.push(data.visual_variation_id); }
  if (data.format              !== undefined) { fields.push(`format = $${i++}`);              values.push(data.format); }

  if (!fields.length) throw createError('Nada que actualizar', 400);

  values.push(postId);
  const [updated] = await query<Post>(
    `UPDATE posts SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
  );
  return updated;
}
