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

  // Apps sin auditar por TikTok solo pueden publicar en SELF_ONLY —
  // PUBLIC_TO_EVERYONE es rechazado con "unaudited_client_can_only_post_to_private_accounts".
  // Default seguro: SELF_ONLY, salvo que TIKTOK_APP_AUDITED='true' esté seteado explícitamente.
  const privacyLevel = process.env.TIKTOK_APP_AUDITED === 'true' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY';

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
        privacy_level:    privacyLevel,
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
    logger.error(`TikTok init error full: ${JSON.stringify(err)}`);
    throw new Error(`TikTok init error: ${err.error?.message ?? initRes.statusText}`);
  }

  const initData = await initRes.json() as { data: { publish_id: string } };
  const publishId = initData.data.publish_id;

  logger.info('[TikTok] Video publicado con publish_id:', publishId);

  const postUrl = `https://www.tiktok.com/@${open_id}/video/${publishId}`;
  return { postId: publishId, postUrl };
}

// ── Consultar estado real de publicación ───────────────────────────────────
// publish_id (arriba) es solo el ID de la transacción de subida — el video
// real puede tardar de minutos a horas en pasar moderación. Este endpoint
// ("Get Post Status" en la doc de TikTok) hay que consultarlo con polling
// hasta PUBLISH_COMPLETE (o FAILED) para obtener el ID público real del video.
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status

export type TikTokPublishStatus =
  | 'PROCESSING_UPLOAD'
  | 'PROCESSING_DOWNLOAD'
  | 'SEND_TO_USER_INBOX'
  | 'PUBLISH_COMPLETE'
  | 'FAILED';

export interface TikTokStatusResult {
  status:   TikTokPublishStatus;
  // Solo viene una vez status === 'PUBLISH_COMPLETE' y el contenido pasó
  // moderación para visualización pública — es el ID real del video,
  // distinto de publish_id.
  postId:   string | null;
  failReason?: string;
}

export async function checkTikTokPublishStatus(
  credentials: TikTokCredentials,
  publishId:   string,
): Promise<TikTokStatusResult> {
  const { access_token } = credentials;

  const res = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type':  'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ publish_id: publishId }),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message: string } };
    throw new Error(`TikTok status fetch error: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json() as {
    data: {
      status?: TikTokPublishStatus;
      publicaly_available_post_id?: number[];
      fail_reason?: string;
    };
  };

  const status = data.data.status ?? 'FAILED';
  const postId = data.data.publicaly_available_post_id?.[0]?.toString() ?? null;

  logger.debug(`[TikTok] Estado de publish_id ${publishId}: ${status}`);

  return { status, postId, failReason: data.data.fail_reason };
}
