import { query } from '../config/database';
import { sendTelegramAlert } from '../services/telegram.service';
import { logger } from '../utils/logger';

interface ExpiringCourtesy {
  user_id:             string;
  email:               string;
  business_name:       string | null;
  courtesy_plan:       string;
  courtesy_expires_at: string;
}

// Revoca cortesías vencidas y alerta por Telegram las que vencen en 3 días.
// Corre una vez al día — ver cron en server.ts.
export async function runCourtesyExpiryCheck(): Promise<void> {
  await revokeExpiredCourtesies();
  await alertUpcomingExpirations();
}

async function revokeExpiredCourtesies(): Promise<void> {
  const revoked = await query<{ user_id: string; email: string }>(
    `UPDATE client_profiles cp
     SET is_courtesy = FALSE, courtesy_plan = NULL, updated_at = NOW()
     FROM users u
     WHERE cp.user_id = u.id
       AND cp.is_courtesy = TRUE
       AND cp.courtesy_expires_at <= NOW()
     RETURNING cp.user_id, u.email`,
  );

  if (revoked.length) {
    logger.info(`[Courtesy] Revocadas ${revoked.length} cortesías vencidas`, {
      emails: revoked.map(r => r.email),
    });
  }
}

async function alertUpcomingExpirations(): Promise<void> {
  const expiringSoon = await query<ExpiringCourtesy>(
    `SELECT cp.user_id, u.email, cp.business_name, cp.courtesy_plan, cp.courtesy_expires_at
     FROM client_profiles cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.is_courtesy = TRUE
       AND cp.courtesy_expires_at::date = (CURRENT_DATE + INTERVAL '3 days')::date`,
  );

  for (const client of expiringSoon) {
    const expiresDate = new Date(client.courtesy_expires_at).toLocaleDateString('es', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const label = client.business_name ? `${client.business_name} (${client.email})` : client.email;

    await sendTelegramAlert(
      `⚠️ <b>Cortesía por vencer</b>\n` +
      `Cliente: ${label}\n` +
      `Plan: ${client.courtesy_plan}\n` +
      `Vence: ${expiresDate} (en 3 días)`,
    );
  }

  if (expiringSoon.length) {
    logger.info(`[Courtesy] Alertadas ${expiringSoon.length} cortesías por vencer en 3 días`);
  }
}
