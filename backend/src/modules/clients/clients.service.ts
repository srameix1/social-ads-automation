import { query, queryOne } from '../../config/database';
import { createError } from '../../middleware/errorHandler';

export type ServicePlan = 'basic' | 'professional' | 'premium';
export type DeliveryMode = 'automatic' | 'manual';

export interface ClientProfile {
  id:                            string;
  user_id:                       string;
  business_name:                 string;
  description:                   string | null;
  photo_1_url:                   string | null;
  photo_2_url:                   string | null;
  photo_3_url:                   string | null;
  plan:                          ServicePlan;
  plan_selected_at:              string | null;
  delivery_mode:                 DeliveryMode | null;
  service_period_started_at:     string | null;
  facebook_grace_period_ends_at: string | null;
  brand_logo_url:                string | null;
  brand_primary_color:           string | null;
  brand_secondary_color:         string | null;
  brand_font:                    string | null;
  setup_completed:               boolean;
  created_at:                    string;
  updated_at:                    string;
}

export async function getProfile(userId: string): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    'SELECT * FROM client_profiles WHERE user_id = $1',
    [userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function updateProfile(
  userId:       string,
  businessName: string,
  description:  string,
): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    `UPDATE client_profiles
     SET business_name = $1, description = $2
     WHERE user_id = $3
     RETURNING *`,
    [businessName, description, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function updatePhotos(
  userId:    string,
  photo1Url: string | null,
  photo2Url: string | null,
  photo3Url: string | null,
): Promise<ClientProfile> {
  const current = await getProfile(userId);

  const p1 = photo1Url ?? current.photo_1_url;
  const p2 = photo2Url ?? current.photo_2_url;
  const p3 = photo3Url ?? current.photo_3_url;

  const setupCompleted = !!(
    (current.business_name || '').trim() &&
    p1 && p2 && p3
  );

  const profile = await queryOne<ClientProfile>(
    `UPDATE client_profiles
     SET photo_1_url = $1, photo_2_url = $2, photo_3_url = $3,
         setup_completed = $4
     WHERE user_id = $5
     RETURNING *`,
    [p1, p2, p3, setupCompleted, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function completeSetup(
  userId:       string,
  businessName: string,
  description:  string,
  photo1Url:    string | null,
  photo2Url:    string | null,
  photo3Url:    string | null,
): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    `UPDATE client_profiles
     SET business_name = $1, description = $2,
         photo_1_url = $3, photo_2_url = $4, photo_3_url = $5,
         setup_completed = TRUE
     WHERE user_id = $6
     RETURNING *`,
    [businessName, description, photo1Url, photo2Url, photo3Url, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function getAllClients() {
  return query<ClientProfile & { email: string; role: string; is_active: boolean }>(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
            cp.business_name, cp.description, cp.setup_completed,
            cp.photo_1_url, cp.photo_2_url, cp.photo_3_url
     FROM users u
     LEFT JOIN client_profiles cp ON cp.user_id = u.id
     WHERE u.role = 'client'
     ORDER BY u.created_at DESC`,
  );
}

export async function selectPlan(userId: string, plan: ServicePlan): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    `UPDATE client_profiles SET plan = $1, plan_selected_at = NOW()
     WHERE user_id = $2 RETURNING *`,
    [plan, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function updatePlan(userId: string, plan: ServicePlan): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    'UPDATE client_profiles SET plan = $1 WHERE user_id = $2 RETURNING *',
    [plan, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

async function updateDeliveryModeInternal(userId: string, deliveryMode: DeliveryMode): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    `UPDATE client_profiles
     SET delivery_mode = $1::delivery_mode,
         service_period_started_at = CASE
           WHEN $1::delivery_mode = 'manual' THEN NOW()
           WHEN $1::delivery_mode = 'automatic' AND EXISTS(SELECT 1 FROM client_credentials cc WHERE cc.client_id = $2 AND cc.platform = 'facebook') THEN NOW()
           ELSE NULL
         END,
         facebook_grace_period_ends_at = CASE
           WHEN $1::delivery_mode = 'manual' THEN NULL
           WHEN $1::delivery_mode = 'automatic' AND EXISTS(SELECT 1 FROM client_credentials cc WHERE cc.client_id = $2 AND cc.platform = 'facebook') THEN NULL
           WHEN $1::delivery_mode = 'automatic' THEN NOW() + INTERVAL '7 days'
           ELSE NULL
         END
     WHERE user_id = $2
     RETURNING *`,
    [deliveryMode, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function selectDeliveryMode(userId: string, deliveryMode: DeliveryMode): Promise<ClientProfile> {
  return updateDeliveryModeInternal(userId, deliveryMode);
}

export async function updateDeliveryMode(userId: string, deliveryMode: DeliveryMode): Promise<ClientProfile> {
  return updateDeliveryModeInternal(userId, deliveryMode);
}

export async function updateBrand(
  userId: string,
  brand:  { primaryColor?: string; secondaryColor?: string; font?: string },
): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    `UPDATE client_profiles
     SET brand_primary_color = COALESCE($1, brand_primary_color),
         brand_secondary_color = COALESCE($2, brand_secondary_color),
         brand_font = COALESCE($3, brand_font)
     WHERE user_id = $4
     RETURNING *`,
    [brand.primaryColor ?? null, brand.secondaryColor ?? null, brand.font ?? null, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function updateBrandLogo(userId: string, logoUrl: string): Promise<ClientProfile> {
  const profile = await queryOne<ClientProfile>(
    'UPDATE client_profiles SET brand_logo_url = $1 WHERE user_id = $2 RETURNING *',
    [logoUrl, userId],
  );
  if (!profile) throw createError('Perfil no encontrado', 404);
  return profile;
}

export async function getReelUsage(userId: string): Promise<{ used: number; quota: number }> {
  const [row] = await query<{ used: string; quota: string }>(
    `SELECT
       (SELECT COUNT(p.id)
        FROM posts p
        JOIN campaigns c ON c.id = p.campaign_id
        WHERE c.client_id = $1
          AND p.format = 'reel'
          AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
       )::int AS used,
       COALESCE(pl.reel_quota, 8) AS quota
     FROM client_profiles cp
     LEFT JOIN plan_limits pl ON pl.plan = cp.plan
     WHERE cp.user_id = $1`,
    [userId],
  );
  return { used: parseInt(row?.used ?? '0'), quota: parseInt(row?.quota ?? '8') };
}

export async function getClientById(id: string) {
  const client = await queryOne<ClientProfile & { email: string }>(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
            cp.business_name, cp.description, cp.setup_completed,
            cp.photo_1_url, cp.photo_2_url, cp.photo_3_url, cp.updated_at
     FROM users u
     LEFT JOIN client_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'client'`,
    [id],
  );
  if (!client) throw createError('Cliente no encontrado', 404);
  return client;
}
