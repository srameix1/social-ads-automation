import { query, queryOne, withTransaction, pool } from '../../config/database';
import { createError } from '../../middleware/errorHandler';
import { generateAdStrategies } from '../../services/claude.service';
import { logger } from '../../utils/logger';
import { PoolClient } from 'pg';

export interface Campaign {
  id:              string;
  client_id:       string;
  title:           string;
  objective:       string | null;
  target_audience: string | null;
  platforms:       string[];
  status:          string;
  error_message:   string | null;
  created_at:      string;
  updated_at:      string;
}

export interface CampaignWithStrategies extends Campaign {
  strategies: Strategy[];
  publications: Publication[];
}

interface Strategy {
  id:             string;
  title:          string;
  description:    string;
  copy_text:      string;
  visual_concept: string;
  tone:           string | null;
  target_hook:    string | null;
  position:       number;
  selected:       boolean;
}

interface Publication {
  id:           string;
  platform:     string;
  status:       string;
  post_url:     string | null;
  published_at: string | null;
}

export async function listCampaigns(clientId: string): Promise<Campaign[]> {
  return query<Campaign>(
    'SELECT * FROM campaigns WHERE client_id = $1 ORDER BY created_at DESC',
    [clientId],
  );
}

export async function getCampaign(id: string, clientId: string): Promise<CampaignWithStrategies> {
  const campaign = await queryOne<Campaign>(
    'SELECT * FROM campaigns WHERE id = $1 AND client_id = $2',
    [id, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada', 404);

  const strategies = await query<Strategy>(
    'SELECT * FROM strategies WHERE campaign_id = $1 ORDER BY position',
    [id],
  );

  const publications = await query<Publication>(
    'SELECT id, platform, status, post_url, published_at FROM publications WHERE campaign_id = $1',
    [id],
  );

  return { ...campaign, strategies, publications };
}

export async function createCampaign(
  clientId:       string,
  title:          string,
  objective:      string,
  targetAudience: string,
  platforms:      string[],
): Promise<CampaignWithStrategies> {
  if (!platforms.length) throw createError('Selecciona al menos una plataforma', 400);

  // Step 1: Create campaign row + fetch client profile — short transaction, releases connection immediately
  const { campaign, profile } = await withTransaction(async (client: PoolClient) => {
    const [campaign] = await client.query<Campaign>(
      `INSERT INTO campaigns (client_id, title, objective, target_audience, platforms, status)
       VALUES ($1, $2, $3, $4, $5, 'generating')
       RETURNING *`,
      [clientId, title, objective, targetAudience, platforms],
    ).then(r => r.rows);

    const profileRow = await client.query(
      'SELECT business_name, description FROM client_profiles WHERE user_id = $1',
      [clientId],
    );
    const profile = profileRow.rows[0] as { business_name: string; description: string };

    return { campaign, profile };
  });

  logger.info(`[Campaign] Campaña ${campaign.id} creada. Llamando a Claude...`);

  // Step 2: Call Claude OUTSIDE the transaction so the DB connection is free during the AI call
  let strategies: Strategy[] = [];
  try {
    const drafts = await generateAdStrategies({
      businessName:   profile?.business_name || 'Negocio',
      description:    profile?.description   || '',
      objective,
      targetAudience,
      platforms,
    });

    logger.info(`[Campaign] Claude devolvió ${drafts.length} estrategias para campaña ${campaign.id}`);

    // Step 3: Save strategies + update status — another short transaction
    strategies = await withTransaction(async (client: PoolClient) => {
      const saved: Strategy[] = [];
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        const [s] = await client.query<Strategy>(
          `INSERT INTO strategies (campaign_id, title, description, copy_text, visual_concept, tone, target_hook, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [campaign.id, d.title, d.description, d.copy_text, d.visual_concept, d.tone, d.target_hook, i + 1],
        ).then(r => r.rows);
        saved.push(s);
      }
      await client.query(
        "UPDATE campaigns SET status = 'pending_selection' WHERE id = $1",
        [campaign.id],
      );
      return saved;
    });

    campaign.status = 'pending_selection';
  } catch (err) {
    logger.error('[Campaign] Error generando estrategias:', err);

    // Mark campaign as failed using a simple query (no transaction needed)
    await pool.query(
      "UPDATE campaigns SET status = 'failed', error_message = $1 WHERE id = $2",
      [(err as Error).message, campaign.id],
    );
    campaign.status = 'failed';
    campaign.error_message = (err as Error).message;
  }

  return { ...campaign, strategies, publications: [] };
}
