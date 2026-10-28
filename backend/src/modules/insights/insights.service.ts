import { query, queryOne } from '../../config/database';
import { createError } from '../../middleware/errorHandler';
import { getDecryptedCredentials } from '../credentials/credentials.service';
import {
  fetchFacebookInsight,
  fetchInstagramInsight,
  TIKTOK_INSIGHTS_UNAVAILABLE_REASON,
  type PlatformInsight,
} from '../../services/insights.service';
import { logger } from '../../utils/logger';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type InsightStatus = 'available' | 'unavailable' | 'not_connected';

export interface PublicationInsight {
  publication_id: string;
  platform: string;
  post_url: string | null;
  published_at: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  status: InsightStatus;
  unavailable_reason: string | null;
  fetched_at: string | null;
}

interface PublicationRow {
  id: string;
  platform: string;
  post_id: string | null;
  post_url: string | null;
  published_at: string | null;
}

interface CachedRow {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  status: InsightStatus;
  unavailable_reason: string | null;
  fetched_at: string;
}

async function fetchLive(
  clientId: string,
  pub: PublicationRow,
): Promise<Omit<PublicationInsight, 'publication_id' | 'platform' | 'post_url' | 'published_at'>> {
  if (!pub.post_id) {
    return {
      reach: null, likes: null, comments: null, shares: null,
      status: 'unavailable', unavailable_reason: 'La publicación no tiene un ID en la plataforma.',
      fetched_at: new Date().toISOString(),
    };
  }

  if (pub.platform === 'tiktok') {
    return {
      reach: null, likes: null, comments: null, shares: null,
      status: 'unavailable', unavailable_reason: TIKTOK_INSIGHTS_UNAVAILABLE_REASON,
      fetched_at: new Date().toISOString(),
    };
  }

  try {
    const creds = await getDecryptedCredentials(clientId, pub.platform as 'facebook' | 'instagram');
    let insight: PlatformInsight;
    if (pub.platform === 'facebook') {
      insight = await fetchFacebookInsight(pub.post_id, creds.page_access_token);
    } else if (pub.platform === 'instagram') {
      insight = await fetchInstagramInsight(pub.post_id, creds.access_token);
    } else {
      return {
        reach: null, likes: null, comments: null, shares: null,
        status: 'unavailable', unavailable_reason: `Plataforma no soportada para estadísticas: ${pub.platform}`,
        fetched_at: new Date().toISOString(),
      };
    }
    return { ...insight, status: 'available', unavailable_reason: null, fetched_at: new Date().toISOString() };
  } catch (err) {
    const message = (err as Error).message ?? '';
    if (message.includes('No hay credenciales')) {
      return {
        reach: null, likes: null, comments: null, shares: null,
        status: 'not_connected', unavailable_reason: 'La cuenta de esta plataforma no está conectada.',
        fetched_at: new Date().toISOString(),
      };
    }
    logger.warn('[Insights] Fetch failed:', message);
    return {
      reach: null, likes: null, comments: null, shares: null,
      status: 'unavailable', unavailable_reason: 'No se pudieron leer las estadísticas en este momento.',
      fetched_at: new Date().toISOString(),
    };
  }
}

export async function getCampaignInsights(
  clientId: string,
  campaignId: string,
  refresh: boolean,
): Promise<{ insights: PublicationInsight[]; totals: { reach: number; likes: number; comments: number; shares: number } }> {
  const campaign = await queryOne<{ id: string }>(
    'SELECT id FROM campaigns WHERE id = $1 AND client_id = $2', [campaignId, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada', 404);

  const pubs = await query<PublicationRow>(
    `SELECT id, platform, post_id, post_url, published_at FROM publications
     WHERE campaign_id = $1 AND status = 'published' AND post_id IS NOT NULL
     ORDER BY published_at DESC NULLS LAST, created_at DESC`,
    [campaignId],
  );

  const insights: PublicationInsight[] = [];
  for (const pub of pubs) {
    let cached: CachedRow | null = null;
    if (!refresh) {
      cached = await queryOne<CachedRow>(
        'SELECT reach, likes, comments, shares, status, unavailable_reason, fetched_at FROM publication_insights WHERE publication_id = $1',
        [pub.id],
      );
      if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
        insights.push({
          publication_id: pub.id, platform: pub.platform, post_url: pub.post_url,
          published_at: pub.published_at, ...cached,
        });
        continue;
      }
    }

    const live = await fetchLive(clientId, pub);
    await query(
      `INSERT INTO publication_insights (publication_id, reach, likes, comments, shares, status, unavailable_reason, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (publication_id) DO UPDATE SET
         reach = EXCLUDED.reach, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
         shares = EXCLUDED.shares, status = EXCLUDED.status,
         unavailable_reason = EXCLUDED.unavailable_reason, fetched_at = NOW()`,
      [pub.id, live.reach, live.likes, live.comments, live.shares, live.status, live.unavailable_reason],
    );
    insights.push({
      publication_id: pub.id, platform: pub.platform, post_url: pub.post_url,
      published_at: pub.published_at, ...live,
    });
  }

  const sum = (key: 'reach' | 'likes' | 'comments' | 'shares') =>
    insights.reduce((acc, i) => acc + (i[key] ?? 0), 0);

  return {
    insights,
    totals: { reach: sum('reach'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares') },
  };
}
