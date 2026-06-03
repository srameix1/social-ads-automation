/**
 * TikTok Content Posting API — publica video en la cuenta del cliente.
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 *
 * Credenciales requeridas (se guardan cifradas en client_credentials):
 *   access_token: OAuth 2.0 access token
 *   open_id:      ID único del usuario en TikTok
 *
 * Nota: TikTok solo acepta videos (no imágenes estáticas).
 */

import { logger } from '../utils/logger';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

export interface TikTokCredentials {
  access_token: string;
  open_id:      string;
}

export interface PublishResult {
  postId:  string;
  postUrl: string;
}

export async function publishToTikTok(
  credentials: TikTokCredentials,
  videoUrl:    string,
  caption:     string,
): Promise<PublishResult> {
  const { access_token, open_id } = credentials;

  // Paso 1: Iniciar la subida del video por URL
  const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type':  'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title:            caption.slice(0, 150),
        privacy_level:    'PUBLIC_TO_EVERYONE',
        disable_duet:     false,
        disable_comment:  false,
        disable_stitch:   false,
      },
      source_info: {
        source:    'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json() as { error?: { message: string } };
    throw new Error(`TikTok init error: ${err.error?.message ?? initRes.statusText}`);
  }

  const initData = await initRes.json() as { data: { publish_id: string } };
  const publishId = initData.data.publish_id;

  logger.info('[TikTok] Video publicado con publish_id:', publishId);

  const postUrl = `https://www.tiktok.com/@${open_id}/video/${publishId}`;
  return { postId: publishId, postUrl };
}
