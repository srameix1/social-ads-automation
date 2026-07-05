import { query, queryOne } from '../../config/database';
import { createError } from '../../middleware/errorHandler';

export async function getStats() {
  const [row] = await query<{
    total_clients:      string;
    total_campaigns:    string;
    active_campaigns:   string;
    completed_campaigns: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'client') AS total_clients,
      (SELECT COUNT(*) FROM campaigns)                   AS total_campaigns,
      (SELECT COUNT(*) FROM campaigns WHERE status NOT IN ('completed','failed','draft')) AS active_campaigns,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'completed') AS completed_campaigns
  `);
  return {
    totalClients:       parseInt(row.total_clients),
    totalCampaigns:     parseInt(row.total_campaigns),
    activeCampaigns:    parseInt(row.active_campaigns),
    completedCampaigns: parseInt(row.completed_campaigns),
  };
}

export async function getAllClients() {
  return query<{
    id: string; email: string; is_active: boolean; created_at: string;
    business_name: string; setup_completed: boolean; plan: string; campaign_count: string;
    is_trial: boolean; trial_posts_limit: number; posts_used: number;
    admin_notes: string | null; registration_ip: string | null;
    duplicate_ip: boolean;
  }>(`
    SELECT u.id, u.email, u.is_active, u.created_at,
           cp.business_name, cp.setup_completed, cp.plan,
           cp.is_trial, cp.trial_posts_limit, cp.posts_used,
           cp.admin_notes, cp.registration_ip,
           COUNT(c.id) AS campaign_count,
           CASE
             WHEN cp.registration_ip IS NOT NULL
                  AND COUNT(*) OVER (PARTITION BY cp.registration_ip) > 1
             THEN TRUE ELSE FALSE
           END AS duplicate_ip
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    LEFT JOIN campaigns c        ON c.client_id = u.id
    WHERE u.role = 'client'
    GROUP BY u.id, u.email, u.is_active, u.created_at,
             cp.business_name, cp.setup_completed, cp.plan,
             cp.is_trial, cp.trial_posts_limit, cp.posts_used,
             cp.admin_notes, cp.registration_ip
    ORDER BY u.created_at DESC
  `);
}

export async function updateClient(
  userId: string,
  data: Partial<{ trial_posts_limit: number; admin_notes: string }>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (data.trial_posts_limit !== undefined) { fields.push(`trial_posts_limit = $${i++}`); values.push(data.trial_posts_limit); }
  if (data.admin_notes       !== undefined) { fields.push(`admin_notes = $${i++}`);       values.push(data.admin_notes); }

  if (!fields.length) throw createError('Nada que actualizar', 400);

  values.push(userId);
  const result = await query<{ user_id: string }>(
    `UPDATE client_profiles SET ${fields.join(', ')} WHERE user_id = $${i} RETURNING user_id`,
    values,
  );
  if (!result.length) throw createError('Cliente no encontrado', 404);
}

export async function getClientDetail(id: string) {
  const client = await queryOne<{
    id: string; email: string; is_active: boolean; created_at: string;
    business_name: string; description: string; setup_completed: boolean; plan: string;
    photo_1_url: string; photo_2_url: string; photo_3_url: string;
  }>(`
    SELECT u.id, u.email, u.is_active, u.created_at,
           cp.business_name, cp.description, cp.setup_completed, cp.plan,
           cp.photo_1_url, cp.photo_2_url, cp.photo_3_url
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    WHERE u.id = $1 AND u.role = 'client'
  `, [id]);

  if (!client) throw createError('Cliente no encontrado', 404);

  const campaigns = await query<{
    id: string; title: string; status: string; platforms: string[];
    month_year: string | null; max_posts: number; posts_used: number; created_at: string;
  }>(
    `SELECT c.id, c.title, c.status, c.platforms, c.month_year, c.max_posts,
       (SELECT COUNT(*)::int FROM posts WHERE campaign_id = c.id) AS posts_used,
       c.created_at
     FROM campaigns c
     WHERE c.client_id = $1
     ORDER BY c.created_at DESC`,
    [id],
  );

  const credentialPlatforms = await query<{ platform: string }>(
    'SELECT platform FROM client_credentials WHERE client_id = $1',
    [id],
  );

  return { ...client, campaigns, connectedPlatforms: credentialPlatforms.map(r => r.platform) };
}

export async function getAllCampaigns() {
  return query<{
    id: string; title: string; status: string; platforms: string[];
    created_at: string; client_email: string; business_name: string;
  }>(`
    SELECT c.id, c.title, c.status, c.platforms, c.created_at,
           u.email AS client_email,
           cp.business_name
    FROM campaigns c
    JOIN users u          ON u.id = c.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = c.client_id
    ORDER BY c.created_at DESC
  `);
}

export async function getCampaignDetail(id: string) {
  const campaign = await queryOne<{ id: string }>('SELECT * FROM campaigns WHERE id = $1', [id]);
  if (!campaign) throw createError('Campaña no encontrada', 404);

  const strategies   = await query('SELECT * FROM strategies WHERE campaign_id = $1 ORDER BY position', [id]);
  const publications = await query('SELECT * FROM publications WHERE campaign_id = $1', [id]);
  const mediaAssets  = await query('SELECT * FROM media_assets WHERE campaign_id = $1', [id]);

  return { ...campaign, strategies, publications, mediaAssets };
}

// ── Plan limits ─────────────────────────────────────────────────────────────

export interface PlanLimit {
  id:                     string;
  plan:                   string;
  max_posts_per_campaign: number;
  can_upload_photos:      boolean;
  can_generate_video:     boolean;
  can_generate_reel:      boolean;
  created_at:             string;
  updated_at:             string;
}

export async function getPlanLimits(): Promise<PlanLimit[]> {
  return query<PlanLimit>(
    'SELECT * FROM plan_limits ORDER BY plan',
  );
}

export async function updatePlanLimit(
  plan: string,
  data: Partial<Pick<PlanLimit, 'max_posts_per_campaign' | 'can_upload_photos' | 'can_generate_video' | 'can_generate_reel'>>,
): Promise<PlanLimit> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (data.max_posts_per_campaign !== undefined) { fields.push(`max_posts_per_campaign = $${i++}`); values.push(data.max_posts_per_campaign); }
  if (data.can_upload_photos      !== undefined) { fields.push(`can_upload_photos = $${i++}`);      values.push(data.can_upload_photos); }
  if (data.can_generate_video     !== undefined) { fields.push(`can_generate_video = $${i++}`);     values.push(data.can_generate_video); }
  if (data.can_generate_reel      !== undefined) { fields.push(`can_generate_reel = $${i++}`);      values.push(data.can_generate_reel); }

  if (!fields.length) throw createError('Nada que actualizar', 400);

  values.push(plan);
  const [updated] = await query<PlanLimit>(
    `UPDATE plan_limits SET ${fields.join(', ')} WHERE plan = $${i} RETURNING *`,
    values,
  );
  if (!updated) throw createError(`Plan '${plan}' no encontrado`, 404);
  return updated;
}

export async function updateCampaignMaxPosts(campaignId: string, maxPosts: number): Promise<void> {
  const result = await query<{ id: string }>(
    'UPDATE campaigns SET max_posts = $1 WHERE id = $2 RETURNING id',
    [maxPosts, campaignId],
  );
  if (!result.length) throw createError('Campaña no encontrada', 404);
}
