import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function sendTelegramAlert(message: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    logger.warn('[Telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados — alerta omitida', { message });
    return;
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    env.TELEGRAM_CHAT_ID,
        text:       message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn('[Telegram] sendMessage falló', { status: res.status, body });
    }
  } catch (err) {
    logger.warn('[Telegram] Error de red enviando alerta', { error: (err as Error).message });
  }
}
