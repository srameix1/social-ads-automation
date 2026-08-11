import { query, queryOne } from '../../config/database';
import { createError } from '../../middleware/errorHandler';

export interface Publication {
  id:                string;
  campaign_id:       string;
  strategy_id:       string;
  media_asset_id:    string | null;
  internal_post_id:  string | null;
  platform:          string;
  status:            string;
  post_id:           string | null;
  post_url:          string | null;
  container_id:      string | null;
  error_message:     string | null;
  published_at:      string | null;
  created_at:        string;
}

export async function getPublications(campaignId: string, clientId: string): Promise<Publication[]> {
  // Verifica que la campaña pertenece al cliente
  const campaign = await queryOne(
    'SELECT id FROM campaigns WHERE id = $1 AND client_id = $2',
    [campaignId, clientId],
  );
  if (!campaign) throw createError('Campaña no encontrada', 404);

  return query<Publication>(
    'SELECT * FROM publications WHERE campaign_id = $1 ORDER BY created_at',
    [campaignId],
  );
}
