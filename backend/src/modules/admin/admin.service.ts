import { query, queryOne } from '../../config/database';
import { createError } from '../../middleware/errorHandler';

export async function getStats() {
  const [row] = await query<{
    total_clients:   string;
    total_campaigns: string;
    active_campaigns: string;
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
    business_name: string; setup_completed: boolean; campaign_count: string;
  }>(`
    SELECT u.id, u.email, u.is_active, u.created_at,
           cp.business_name, cp.setup_completed,
           COUNT(c.id) AS campaign_count
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    LEFT JOIN campaigns c        ON c.client_id = u.id
    WHERE u.role = 'client'
    GROUP BY u.id, u.email, u.is_active, u.created_at,
             cp.business_name, cp.setup_completed
    ORDER BY u.created_at DESC
  `);
}

export async function getClientDetail(id: string) {
  const client = await queryOne<{
    id: string; email: string; is_active: boolean; created_at: string;
    business_name: string; description: string; setup_completed: boolean;
    photo_1_url: string; photo_2_url: string; photo_3_url: string;
  }>(`
    SELECT u.id, u.email, u.is_active, u.created_at,
           cp.business_name, cp.description, cp.setup_completed,
           cp.photo_1_url, cp.photo_2_url, cp.photo_3_url
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    WHERE u.id = $1 AND u.role = 'client'
  `, [id]);

  if (!client) throw createError('Cliente no encontrado', 404);

  const campaigns = await query(
    'SELECT * FROM campaigns WHERE client_id = $1 ORDER BY created_at DESC',
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
