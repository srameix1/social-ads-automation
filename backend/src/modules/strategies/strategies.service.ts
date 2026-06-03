import fs   from 'fs';
import path from 'path';
import { query, queryOne, withTransaction } from '../../config/database';
import { createError } from '../../middleware/errorHandler';
import { generateMediaVariations } from '../../services/nanabanana.service';
import { publishToInstagram } from '../../services/instagram.service';
import { publishToTikTok }    from '../../services/tiktok.service';
import { publishToFacebook }  from '../../services/facebook.service';
import { getDecryptedCredentials } from '../credentials/credentials.service';
import { logger } from '../../utils/logger';
import { env }    from '../../config/env';
import { PoolClient } from 'pg';

interface Strategy {
  id:             string;
  campaign_id:    string;
  title:          string;
  copy_text:      string;
  visual_concept: string;
}

interface Campaign {
  id:              string;
  client_id:       string;
  platforms:       string[];
  status:          string;
  title:           string;
}

export async function retryPublishing(
  campaignId: string,
  clientId:   string,
): Promise<void> {
  const campaign = await queryOne<Campaign>(
    "SELECT * FROM campaigns WHERE id = $1 AND client_id = $2 AND status = 'failed'",
    [campaignId, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada o no está en estado fallido', 404);

  const strategy = await queryOne<Strategy>(
    'SELECT * FROM strategies WHERE campaign_id = $1 AND selected = TRUE',
    [campaignId],
  );
  if (!strategy) throw createError('No hay estrategia seleccionada para reintentar', 400);

  // Reset state for a clean retry
  await query("UPDATE campaigns SET status = 'creating_media', error_message = NULL WHERE id = $1", [campaignId]);
  await query("DELETE FROM publications WHERE campaign_id = $1", [campaignId]);
  await query(
    `UPDATE media_assets SET status = 'generating', url = NULL, nanabanana_job_id = NULL
     WHERE campaign_id = $1 AND strategy_id = $2`,
    [campaignId, strategy.id],
  );

  setImmediate(() => processMediaAndPublish(campaign, strategy, clientId));
}

export async function selectStrategy(
  campaignId: string,
  strategyId: string,
  clientId:   string,
): Promise<void> {
  // Run DB updates inside a transaction
  await withTransaction(async (dbClient: PoolClient) => {
    const campaign = await dbClient.query<Campaign>(
      "SELECT * FROM campaigns WHERE id = $1 AND client_id = $2 AND status = 'pending_selection'",
      [campaignId, clientId],
    ).then(r => r.rows[0]);

    if (!campaign) {
      throw createError('Campaña no encontrada o no está en estado de selección', 404);
    }

    const strategy = await dbClient.query<Strategy>(
      'SELECT * FROM strategies WHERE id = $1 AND campaign_id = $2',
      [strategyId, campaignId],
    ).then(r => r.rows[0]);

    if (!strategy) throw createError('Estrategia no encontrada', 404);

    await dbClient.query('UPDATE strategies SET selected = TRUE WHERE id = $1', [strategyId]);
    await dbClient.query(
      "UPDATE campaigns SET status = 'creating_media' WHERE id = $1",
      [campaignId],
    );

    // One media_asset per platform (existing schema)
    for (const platform of campaign.platforms) {
      await dbClient.query(
        `INSERT INTO media_assets (campaign_id, strategy_id, type, status, platform, prompt_used)
         VALUES ($1, $2, $3, 'generating', $4, $5)`,
        [
          campaignId, strategyId,
          platform === 'tiktok' ? 'video' : 'image',
          platform,
          strategy.visual_concept,
        ],
      );
    }
  });

  // Kick off media generation + publishing asynchronously after the transaction commits
  const strategy = await queryOne<Strategy>('SELECT * FROM strategies WHERE id = $1', [strategyId]);
  const campaign = await queryOne<Campaign>('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (strategy && campaign) {
    setImmediate(() => processMediaAndPublish(campaign, strategy, clientId));
  }
}

async function processMediaAndPublish(
  campaign: Campaign,
  strategy: Strategy,
  clientId: string,
): Promise<void> {
  try {
    const mediaAssets = await query<{ id: string; platform: string; type: 'image' | 'video' }>(
      'SELECT id, platform, type FROM media_assets WHERE campaign_id = $1 AND strategy_id = $2',
      [campaign.id, strategy.id],
    );

    await query("UPDATE campaigns SET status = 'publishing' WHERE id = $1", [campaign.id]);

    // Generate all 3 format variations once — Gemini is called here
    const clientPhotos = await loadClientPhotosAsBase64(clientId);
    const variations = await generateMediaVariations({
      prompt:        strategy.visual_concept,
      businessName:  campaign.title,
      copyText:      strategy.copy_text,
      strategyTitle: strategy.title,
      clientPhotos,
      campaignId:    campaign.id,
      strategyId:    strategy.id,
    });

    logger.info(`[Strategy] Variaciones generadas — jobId: ${variations.jobId}`);

    let allSuccess = true;
    let firstAssetError: string | null = null;

    for (const asset of mediaAssets) {
      try {
        // Pick the variation that best fits each platform
        const mediaUrl = pickVariationForPlatform(variations, asset.platform);

        await query(
          "UPDATE media_assets SET status = 'ready', url = $1, nanabanana_job_id = $2 WHERE id = $3",
          [mediaUrl, variations.jobId, asset.id],
        );

        await publishToSocialMedia(
          asset.platform,
          clientId,
          mediaUrl,
          strategy.copy_text,
          campaign.id,
          strategy.id,
          asset.id,
        );
      } catch (err) {
        logger.error(`[Strategy] Error en plataforma ${asset.platform}:`, err);
        await query("UPDATE media_assets SET status = 'failed' WHERE id = $1", [asset.id]);
        await query(
          `INSERT INTO publications
             (campaign_id, strategy_id, media_asset_id, platform, status, error_message)
           VALUES ($1, $2, $3, $4, 'failed', $5)`,
          [campaign.id, strategy.id, asset.id, asset.platform, (err as Error).message],
        );
        if (!firstAssetError) firstAssetError = (err as Error).message;
        allSuccess = false;
      }
    }

    if (allSuccess) {
      await query("UPDATE campaigns SET status = 'completed' WHERE id = $1", [campaign.id]);
    } else {
      await query(
        "UPDATE campaigns SET status = 'failed', error_message = $1 WHERE id = $2",
        [firstAssetError, campaign.id],
      );
    }
  } catch (err) {
    logger.error('[Strategy] Error procesando media y publicación:', err);
    await query(
      "UPDATE campaigns SET status = 'failed', error_message = $1 WHERE id = $2",
      [(err as Error).message, campaign.id],
    );
  }
}

async function publishToSocialMedia(
  platform:     string,
  clientId:     string,
  mediaUrl:     string,
  caption:      string,
  campaignId:   string,
  strategyId:   string,
  mediaAssetId: string,
): Promise<void> {
  let postId  = '';
  let postUrl = '';

  try {
    const creds = await getDecryptedCredentials(clientId, platform as 'instagram' | 'tiktok' | 'facebook');

    if (platform === 'instagram') {
      const r = await publishToInstagram(creds as Parameters<typeof publishToInstagram>[0], mediaUrl, caption);
      postId = r.postId; postUrl = r.postUrl;
    } else if (platform === 'tiktok') {
      const r = await publishToTikTok(creds as Parameters<typeof publishToTikTok>[0], mediaUrl, caption);
      postId = r.postId; postUrl = r.postUrl;
    } else if (platform === 'facebook') {
      const r = await publishToFacebook(creds as Parameters<typeof publishToFacebook>[0], mediaUrl, caption);
      postId = r.postId; postUrl = r.postUrl;
    }

    await query(
      `INSERT INTO publications
         (campaign_id, strategy_id, media_asset_id, platform, status, post_id, post_url, published_at)
       VALUES ($1, $2, $3, $4, 'published', $5, $6, NOW())`,
      [campaignId, strategyId, mediaAssetId, platform, postId, postUrl],
    );
  } catch (err) {
    await query(
      `INSERT INTO publications
         (campaign_id, strategy_id, media_asset_id, platform, status, error_message)
       VALUES ($1, $2, $3, $4, 'failed', $5)`,
      [campaignId, strategyId, mediaAssetId, platform, (err as Error).message],
    );
    throw err;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pickVariationForPlatform(
  v:        { square: string; vertical: string; horizontal: string },
  platform: string,
): string {
  if (platform === 'tiktok')   return v.vertical;
  if (platform === 'facebook') return v.horizontal;
  return v.square; // instagram and default
}

async function loadClientPhotosAsBase64(clientId: string): Promise<string[]> {
  const profile = await queryOne<{
    photo_1_url: string | null;
    photo_2_url: string | null;
    photo_3_url: string | null;
  }>(
    'SELECT photo_1_url, photo_2_url, photo_3_url FROM client_profiles WHERE user_id = $1',
    [clientId],
  );

  if (!profile) return [];

  const urls = [profile.photo_1_url, profile.photo_2_url, profile.photo_3_url]
    .filter((u): u is string => !!u);

  const photos: string[] = [];

  for (const url of urls) {
    try {
      // Strip the host prefix to get the relative path inside UPLOADS_DIR
      const match = url.match(/\/uploads\/(.+)$/);
      if (!match) continue;

      const filePath = path.join(path.resolve(env.UPLOADS_DIR), match[1]);
      if (!fs.existsSync(filePath)) continue;

      photos.push(fs.readFileSync(filePath).toString('base64'));
    } catch (err) {
      logger.warn('[Strategy] No se pudo cargar foto del cliente:', (err as Error).message);
    }
  }

  return photos;
}
