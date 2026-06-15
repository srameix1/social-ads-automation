import { query, queryOne } from '../../config/database';
import { createError } from '../../middleware/errorHandler';

export interface Campaign {
  id:               string;
  client_id:        string;
  title:            string;
  platforms:        string[];
  month_year:       string | null;
  start_date:       string | null;
  end_date:         string | null;
  max_posts:        number;
  posts_used:       number;
  business_problem: string | null;
  differentiator:   string | null;
  ideal_client:     string | null;
  concrete_result:  string | null;
  client_pain:      string | null;
  created_at:       string;
  updated_at:       string;
}

export interface PostSummary {
  id:                  string;
  campaign_id:         string;
  scheduled_date:      string | null;
  status:              string;
  platforms:           string[];
  format:              string;
  workflow_status:     string;
  selected_visual_url: string | null;
  created_at:          string;
  updated_at:          string;
}

export interface CampaignWithPosts extends Campaign {
  posts: PostSummary[];
}

export async function listCampaigns(clientId: string): Promise<Campaign[]> {
  return query<Campaign>(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM posts WHERE campaign_id = c.id) AS posts_used
     FROM campaigns c
     WHERE c.client_id = $1
     ORDER BY c.created_at DESC`,
    [clientId],
  );
}

export async function getCampaign(id: string, clientId: string): Promise<CampaignWithPosts> {
  const campaign = await queryOne<Campaign>(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM posts WHERE campaign_id = c.id) AS posts_used
     FROM campaigns c
     WHERE c.id = $1 AND c.client_id = $2`,
    [id, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada', 404);

  const posts = await query<PostSummary>(
    `SELECT p.*,
       (SELECT url FROM visual_variations WHERE post_id = p.id AND selected = TRUE LIMIT 1) AS selected_visual_url
     FROM posts p
     WHERE p.campaign_id = $1
     ORDER BY p.scheduled_date ASC NULLS LAST, p.created_at DESC`,
    [id],
  );

  return { ...campaign, posts };
}

export async function createCampaign(
  clientId:        string,
  title:           string,
  platforms:       string[],
  monthYear:       string,
  businessProfile?: {
    businessProblem?: string;
    differentiator?:  string;
    idealClient?:     string;
    concreteResult?:  string;
    clientPain?:      string;
  },
): Promise<Campaign> {
  if (!platforms.length) throw createError('Selecciona al menos una plataforma', 400);

  const maxPosts = await getMaxPostsForClient(clientId);
  const bp = businessProfile ?? {};

  const [campaign] = await query<Campaign>(
    `INSERT INTO campaigns
       (client_id, title, platforms, month_year, max_posts,
        business_problem, differentiator, ideal_client, concrete_result, client_pain)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *, 0 AS posts_used`,
    [
      clientId, title, platforms, monthYear, maxPosts,
      bp.businessProblem ?? null,
      bp.differentiator  ?? null,
      bp.idealClient     ?? null,
      bp.concreteResult  ?? null,
      bp.clientPain      ?? null,
    ],
  );
  return campaign;
}

async function getMaxPostsForClient(clientId: string): Promise<number> {
  try {
    const rows = await query<{ max_posts_per_campaign: number }>(
      `SELECT pl.max_posts_per_campaign
       FROM plan_limits pl
       JOIN client_profiles cp ON cp.plan = pl.plan
       WHERE cp.user_id = $1`,
      [clientId],
    );
    return rows[0]?.max_posts_per_campaign ?? 20;
  } catch {
    return 20;
  }
}
