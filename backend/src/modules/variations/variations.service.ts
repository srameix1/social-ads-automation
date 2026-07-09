import fs   from 'fs';
import path from 'path';
import { query, queryOne } from '../../config/database';
import { createError }     from '../../middleware/errorHandler';
import {
  generateProfessionalVideosFromImage,
  generatePremiumReelFromImage,
  ContentInput,
} from '../../services/contentGeneration.service';
import { publishToInstagram } from '../../services/instagram.service';
import { publishToTikTok }    from '../../services/tiktok.service';
import { publishToFacebook }  from '../../services/facebook.service';
import { getDecryptedCredentials } from '../credentials/credentials.service';
import { logger } from '../../utils/logger';
import { env }    from '../../config/env';

interface VisualVariation {
  id:                    string;
  campaign_id:           string;
  strategy_id:           string;
  position:              number;
  url:                   string | null;
  type:                  string;
  status:                string;
  visual_concept_variant: string | null;
  selected:              boolean;
}

interface Campaign {
  id:        string;
  client_id: string;
  platforms: string[];
  status:    string;
  title:     string;
}

interface Strategy {
  id:          string;
  copy_text:   string;
  visual_concept: string;
}

interface ClientProfile {
  plan:                  string | null;
  business_name:         string | null;
  description:           string | null;
  brand_primary_color:   string | null;
  brand_secondary_color: string | null;
  brand_logo_url:        string | null;
}

// ── Get variations for a campaign ──────────────────────────────────────────

export async function getVariations(
  campaignId: string,
  clientId:   string,
): Promise<VisualVariation[]> {
  const campaign = await queryOne<{ id: string }>(
    'SELECT id FROM campaigns WHERE id = $1 AND client_id = $2',
    [campaignId, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada', 404);

  return query<VisualVariation>(
    'SELECT * FROM visual_variations WHERE campaign_id = $1 ORDER BY position',
    [campaignId],
  );
}

// ── Select a variation → trigger publication ───────────────────────────────

export async function selectVariation(
  campaignId:  string,
  variationId: string,
  clientId:    string,
): Promise<void> {
  const campaign = await queryOne<Campaign>(
    "SELECT * FROM campaigns WHERE id = $1 AND client_id = $2 AND status = 'pending_visual'",
    [campaignId, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada o no está en estado de selección visual', 404);

  const variation = await queryOne<VisualVariation>(
    "SELECT * FROM visual_variations WHERE id = $1 AND campaign_id = $2 AND status = 'ready'",
    [variationId, campaignId],
  );
  if (!variation) throw createError('Variación no encontrada o no está lista', 404);

  await query('UPDATE visual_variations SET selected = TRUE  WHERE id = $1',                      [variationId]);
  await query("UPDATE campaigns          SET status = 'publishing' WHERE id = $1",                [campaignId]);

  setImmediate(() => publishVariation(campaignId, variationId, clientId));
}

// ── Core: publish the chosen variation ────────────────────────────────────

export async function publishVariation(
  campaignId:  string,
  variationId: string,
  clientId:    string,
): Promise<void> {
  try {
    const [campaign, variation] = await Promise.all([
      queryOne<Campaign>('SELECT * FROM campaigns WHERE id = $1', [campaignId]),
      queryOne<VisualVariation>('SELECT * FROM visual_variations WHERE id = $1', [variationId]),
    ]);
    if (!campaign || !variation) throw new Error('Campaign or variation not found');

    const strategy = await queryOne<Strategy>(
      'SELECT * FROM strategies WHERE campaign_id = $1 AND selected = TRUE',
      [campaignId],
    );
    if (!strategy) throw new Error('No selected strategy found');

    const clientProfile = await loadClientProfile(clientId);
    const clientPhotos  = await loadClientPhotosAsBase64(clientId);
    const logoBuffer    = clientProfile.brand_logo_url
      ? await loadLogoAsBuffer(clientProfile.brand_logo_url)
      : undefined;

    const plan         = clientProfile.plan ?? 'basic';
    const primaryColor = clientProfile.brand_primary_color ?? '#1A1A1A';

    const variationImagePath = urlToFilePath(variation.url!);
    const pubDir             = path.resolve(env.UPLOADS_DIR, 'published', campaignId);
    fs.mkdirSync(pubDir, { recursive: true });

    const platformUrls: Record<string, string> = {};

    if (plan === 'premium') {
      const { reel } = await generatePremiumReelFromImage(variationImagePath, pubDir);
      for (const p of campaign.platforms) platformUrls[p] = filePathToUrl(reel);

    } else if (plan === 'professional') {
      const { feed, story } = await generateProfessionalVideosFromImage(variationImagePath, pubDir);
      for (const p of campaign.platforms)
        platformUrls[p] = p === 'tiktok' ? filePathToUrl(story) : filePathToUrl(feed);

    } else {
      // Basic: variation image IS the feed; create a 1080x1920 story crop
      const sharp   = (await import('sharp')).default;
      const storyPath = path.join(pubDir, 'basic_story.jpg');
      await sharp(variationImagePath)
        .resize(1080, 1920, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 92 })
        .toFile(storyPath);

      for (const p of campaign.platforms)
        platformUrls[p] = p === 'tiktok' ? filePathToUrl(storyPath) : variation.url!;
    }

    // Ensure media_asset rows exist for each platform
    for (const platform of campaign.platforms) {
      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM media_assets WHERE campaign_id = $1 AND platform = $2 LIMIT 1',
        [campaignId, platform],
      );
      if (!existing) {
        await query(
          `INSERT INTO media_assets (campaign_id, strategy_id, type, status, platform, prompt_used)
           VALUES ($1, $2, $3, 'generating', $4, $5)`,
          [campaignId, strategy.id,
           platform === 'tiktok' ? 'video' : plan === 'basic' ? 'image' : 'video',
           platform, variation.visual_concept_variant ?? strategy.visual_concept],
        );
      }
    }

    const mediaAssets = await query<{ id: string; platform: string }>(
      'SELECT id, platform FROM media_assets WHERE campaign_id = $1 AND strategy_id = $2',
      [campaignId, strategy.id],
    );

    logger.info(`[Variations] Contenido generado con plan "${plan}" — campaign ${campaignId}`);

    let allSuccess = true;
    let firstError: string | null = null;

    for (const asset of mediaAssets) {
      const mediaUrl = platformUrls[asset.platform];
      if (!mediaUrl) continue;

      try {
        await query(
          "UPDATE media_assets SET status = 'ready', url = $1 WHERE id = $2",
          [mediaUrl, asset.id],
        );
        await publishToSocialMedia(
          asset.platform, clientId, mediaUrl, strategy.copy_text,
          campaignId, strategy.id, asset.id,
        );
      } catch (err) {
        logger.error(`[Variations] Error en plataforma ${asset.platform}:`, err);
        await query("UPDATE media_assets SET status = 'failed' WHERE id = $1", [asset.id]);
        await query(
          `INSERT INTO publications (campaign_id, strategy_id, media_asset_id, platform, status, error_message)
           VALUES ($1, $2, $3, $4, 'failed', $5)`,
          [campaignId, strategy.id, asset.id, asset.platform, (err as Error).message],
        );
        if (!firstError) firstError = (err as Error).message;
        allSuccess = false;
      }
    }

    if (allSuccess) {
      await query("UPDATE campaigns SET status = 'completed' WHERE id = $1", [campaignId]);
    } else {
      await query(
        "UPDATE campaigns SET status = 'failed', error_message = $1 WHERE id = $2",
        [firstError, campaignId],
      );
    }
  } catch (err) {
    logger.error('[Variations] Error publicando variación:', err);
    await query(
      "UPDATE campaigns SET status = 'failed', error_message = $1 WHERE id = $2",
      [(err as Error).message, campaignId],
    );
  }
}

// ── Social media publishing ────────────────────────────────────────────────

export async function publishToSocialMedia(
  platform:     string,
  clientId:     string,
  mediaUrl:     string,
  caption:      string,
  campaignId:   string,
  strategyId:   string,
  mediaAssetId: string | null,
): Promise<void> {
  let postId = '', postUrl = '';
  try {
    const absoluteMediaUrl = mediaUrl.startsWith('/')
      ? `${env.BACKEND_URL}${mediaUrl}`
      : mediaUrl;

    const creds = await getDecryptedCredentials(clientId, platform as 'instagram' | 'tiktok' | 'facebook');
    if (platform === 'instagram') {
      const r = await publishToInstagram(creds as unknown as Parameters<typeof publishToInstagram>[0], absoluteMediaUrl, caption);
      postId = r.postId; postUrl = r.postUrl;
    } else if (platform === 'tiktok') {
      const r = await publishToTikTok(creds as unknown as Parameters<typeof publishToTikTok>[0], absoluteMediaUrl, caption);
      postId = r.postId; postUrl = r.postUrl;
    } else if (platform === 'facebook') {
      const r = await publishToFacebook(creds as unknown as Parameters<typeof publishToFacebook>[0], absoluteMediaUrl, caption);
      postId = r.postId; postUrl = r.postUrl;
    }
    await query(
      `INSERT INTO publications (campaign_id, strategy_id, media_asset_id, platform, status, post_id, post_url, published_at)
       VALUES ($1, $2, $3, $4, 'published', $5, $6, NOW())`,
      [campaignId, strategyId, mediaAssetId, platform, postId, postUrl],
    );
  } catch (err) {
    await query(
      `INSERT INTO publications (campaign_id, strategy_id, media_asset_id, platform, status, error_message)
       VALUES ($1, $2, $3, $4, 'failed', $5)`,
      [campaignId, strategyId, mediaAssetId, platform, (err as Error).message],
    );
    throw err;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function loadClientProfile(clientId: string): Promise<ClientProfile> {
  return await queryOne<ClientProfile>(
    `SELECT plan, business_name, description,
            brand_primary_color, brand_secondary_color, brand_logo_url
     FROM client_profiles WHERE user_id = $1`,
    [clientId],
  ) ?? { plan: null, business_name: null, description: null,
         brand_primary_color: null, brand_secondary_color: null, brand_logo_url: null };
}

async function loadLogoAsBuffer(logoUrl: string): Promise<Buffer | undefined> {
  try {
    const match = logoUrl.match(/\/uploads\/(.+)$/);
    if (!match) return undefined;
    const filePath = path.join(path.resolve(env.UPLOADS_DIR), match[1]);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
  } catch { return undefined; }
}

function filePathToUrl(absolutePath: string): string {
  return `/uploads/${path.relative(path.resolve(env.UPLOADS_DIR), absolutePath).replace(/\\/g, '/')}`;
}

function urlToFilePath(url: string): string {
  const match = url.match(/\/uploads\/(.+)$/);
  if (!match) throw new Error(`Cannot resolve file path from URL: ${url}`);
  return path.join(path.resolve(env.UPLOADS_DIR), match[1]);
}

async function loadClientPhotosAsBase64(clientId: string): Promise<string[]> {
  const profile = await queryOne<{ photo_1_url: string | null; photo_2_url: string | null; photo_3_url: string | null }>(
    'SELECT photo_1_url, photo_2_url, photo_3_url FROM client_profiles WHERE user_id = $1',
    [clientId],
  );
  if (!profile) return [];
  const urls = [profile.photo_1_url, profile.photo_2_url, profile.photo_3_url].filter((u): u is string => !!u);
  const photos: string[] = [];
  for (const url of urls) {
    try {
      const match = url.match(/\/uploads\/(.+)$/);
      if (!match) continue;
      const filePath = path.join(path.resolve(env.UPLOADS_DIR), match[1]);
      if (!fs.existsSync(filePath)) continue;
      photos.push(fs.readFileSync(filePath).toString('base64'));
    } catch { /* skip */ }
  }
  return photos;
}
