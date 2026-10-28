/**
 * Platform insights, read on demand with the tokens already stored in
 * client_credentials. No scope is changed here.
 *
 * Facebook: the page token + pages_read_engagement already granted can read
 * a page post's likes/comments/shares, and post_impressions where available.
 * Instagram: the linked business account token can read the media's
 * like_count/comments_count; reach via insights needs instagram_manage_insights,
 * which is NOT in the current scopes, so reach may legitimately come back
 * null — that is reported, not faked.
 * TikTok: the current scopes are user.info.basic, video.publish and
 * video.upload only. Reading a video's stats needs a read scope such as
 * video.list, which is not granted, so TikTok is reported as unavailable
 * with that exact reason instead of calling an API that would fail.
 */
import { logger } from '../utils/logger';

const GRAPH_URL = 'https://graph.facebook.com/v26.0';

export interface PlatformInsight {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

async function graphGet(path: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH_URL}${path}${sep}access_token=${encodeURIComponent(token)}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as { message?: string } | undefined)?.message ?? res.statusText;
    throw new Error(`Meta API error: ${msg}`);
  }
  return data;
}

function insightValue(data: Record<string, unknown>, metric: string): number | null {
  const list = (data.data as Array<{ name?: string; values?: Array<{ value?: number }> }> | undefined) ?? [];
  const entry = list.find(m => m.name === metric);
  const value = entry?.values?.[0]?.value;
  return typeof value === 'number' ? value : null;
}

export async function fetchFacebookInsight(
  postId: string,
  pageAccessToken: string,
): Promise<PlatformInsight> {
  const post = await graphGet(
    `/${encodeURIComponent(postId)}?fields=likes.summary(true),comments.summary(true),shares`,
    pageAccessToken,
  );
  let reach: number | null = null;
  try {
    const insights = await graphGet(
      `/${encodeURIComponent(postId)}/insights?metric=post_impressions,post_engaged_users`,
      pageAccessToken,
    );
    reach = insightValue(insights, 'post_impressions');
  } catch (err) {
    // Reach is nice-to-have; counts already retrieved are still valid.
    logger.warn('[Insights] Facebook reach unavailable:', (err as Error).message);
  }
  return {
    reach,
    likes: ((post.likes as { summary?: { total_count?: number } } | undefined)?.summary?.total_count) ?? null,
    comments: ((post.comments as { summary?: { total_count?: number } } | undefined)?.summary?.total_count) ?? null,
    shares: ((post.shares as { count?: number } | undefined)?.count) ?? null,
  };
}

export async function fetchInstagramInsight(
  mediaId: string,
  accessToken: string,
): Promise<PlatformInsight> {
  const media = await graphGet(
    `/${encodeURIComponent(mediaId)}?fields=like_count,comments_count`,
    accessToken,
  );
  let reach: number | null = null;
  let likes = typeof media.like_count === 'number' ? media.like_count : null;
  let comments = typeof media.comments_count === 'number' ? media.comments_count : null;
  let shares: number | null = null;
  try {
    const insights = await graphGet(
      `/${encodeURIComponent(mediaId)}/insights?metric=reach,likes,comments,saved,shares`,
      accessToken,
    );
    reach = insightValue(insights, 'reach');
    const iLikes = insightValue(insights, 'likes');
    const iComments = insightValue(insights, 'comments');
    if (iLikes !== null) likes = iLikes;
    if (iComments !== null) comments = iComments;
    shares = insightValue(insights, 'shares');
  } catch (err) {
    // instagram_manage_insights is not in the current scopes, so this
    // failing is expected; the basic counts above still stand.
    logger.warn('[Insights] Instagram insights unavailable, using counts:', (err as Error).message);
  }
  return { reach, likes, comments, shares };
}

export const TIKTOK_INSIGHTS_UNAVAILABLE_REASON =
  'TikTok no está conectado para lectura de estadísticas: los permisos actuales solo permiten publicar (user.info.basic, video.publish, video.upload). Para leer estadísticas haría falta un permiso de lectura como video.list, que hoy no está solicitado.';
