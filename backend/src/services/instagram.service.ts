/**
 * Instagram Graph API — publica imagen o video en la cuenta del cliente.
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * Credenciales requeridas (se guardan cifradas en client_credentials):
 *   access_token:          User Access Token con permisos instagram_business_basic, instagram_business_content_publish
 *   instagram_account_id:  ID de la cuenta de Instagram (obtenido vía /me/accounts)
 */

import { logger } from '../utils/logger';

const GRAPH_URL = 'https://graph.facebook.com/v26.0';

export interface InstagramCredentials {
  access_token:          string;
  instagram_account_id:  string;
}

export interface PublishResult {
  postId:  string;
  postUrl: string;
}

// Ya no la llama el flujo de video por cola (publishPost.job.ts) — ese
// reemplazó la espera bloqueante de 5 min por polling asíncrono vía pg-boss
// (ver instagram-check-status), igual que ya existía para TikTok. Sigue
// usándola publishToInstagram, el wrapper síncrono para el caller legacy de
// variations.service.ts.
async function waitForContainerReady(
  baseUrl:      string,
  creationId:   string,
  access_token: string,
): Promise<void> {
  const maxAttempts = 60; // ~5 minutos con 5s de espera
  for (let i = 0; i < maxAttempts; i++) {
    const res  = await fetch(`${baseUrl}/${creationId}?fields=status_code&access_token=${access_token}`);
    const data = await res.json() as { status_code?: string };
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram container processing failed: ${JSON.stringify(data)}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Instagram container timeout esperando FINISHED (5 min)');
}

export interface CreateContainerResult {
  creationId: string;
  isVideo:    boolean;
}

export async function createInstagramContainer(
  credentials: InstagramCredentials,
  mediaUrl:    string,
  caption:     string,
): Promise<CreateContainerResult> {
  const { access_token, instagram_account_id } = credentials;
  const baseUrl = `${GRAPH_URL}/${instagram_account_id}`;
  const isVideo = /\.(mp4|mov)$/i.test(mediaUrl);

  const containerRes = await fetch(`${baseUrl}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      isVideo
        ? {
            media_type:   'REELS',
            video_url:    mediaUrl,
            caption:      caption,
            access_token: access_token,
          }
        : {
            image_url:    mediaUrl,
            caption:      caption,
            access_token: access_token,
          },
    ),
  });

  if (!containerRes.ok) {
    const err = await containerRes.json() as { error?: { message: string } };
    throw new Error(`Instagram container error: ${err.error?.message ?? containerRes.statusText}`);
  }

  const { id: creationId } = await containerRes.json() as { id: string };
  logger.debug('[Instagram] Container creado:', creationId);

  return { creationId, isVideo };
}

export interface ContainerStatusResult {
  // Valores documentados por Graph API: IN_PROGRESS, FINISHED, ERROR, EXPIRED,
  // PUBLISHED. Cualquier otro valor (o ausente) se trata como "sigue en progreso".
  statusCode: string | null;
  // Campo "status" — texto descriptivo, puede traer más detalle que status_code.
  statusText: string | null;
}

export async function checkInstagramContainerStatus(
  instagramAccountId: string,
  creationId:          string,
  accessToken:         string,
): Promise<ContainerStatusResult> {
  const res  = await fetch(`${GRAPH_URL}/${creationId}?fields=status_code,status&access_token=${accessToken}`);
  const data = await res.json() as { status_code?: string; status?: string; error?: { message: string } };

  if (!res.ok) {
    throw new Error(`Instagram container status error: ${data.error?.message ?? res.statusText}`);
  }

  return { statusCode: data.status_code ?? null, statusText: data.status ?? null };
}

export async function publishInstagramContainer(
  credentials: InstagramCredentials,
  creationId:  string,
): Promise<PublishResult> {
  const { access_token, instagram_account_id } = credentials;
  const baseUrl = `${GRAPH_URL}/${instagram_account_id}`;

  const publishRes = await fetch(`${baseUrl}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id:  creationId,
      access_token: access_token,
    }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.json() as { error?: { message: string } };
    throw new Error(`Instagram publish error: ${err.error?.message ?? publishRes.statusText}`);
  }

  const { id: postId } = await publishRes.json() as { id: string };
  const postUrl = `https://www.instagram.com/p/${postId}/`;

  logger.info('[Instagram] Publicado exitosamente:', postId);
  return { postId, postUrl };
}

// Compone las dos funciones de arriba — se mantiene para publishToSocialMedia
// (variations.service.ts), que publica de forma síncrona fuera de la cola de
// pg-boss y espera el resultado final en la misma llamada. El flujo por cola
// (publishPost.job.ts) ya no pasa por acá para video: usa createInstagramContainer
// + instagram-check-status + publishInstagramContainer por separado.
export async function publishToInstagram(
  credentials: InstagramCredentials,
  mediaUrl:    string,
  caption:     string,
): Promise<PublishResult> {
  const { access_token, instagram_account_id } = credentials;
  const baseUrl = `${GRAPH_URL}/${instagram_account_id}`;
  const { creationId, isVideo } = await createInstagramContainer(credentials, mediaUrl, caption);

  if (isVideo) {
    logger.info(`[Instagram] Esperando procesamiento del container: ${creationId}`);
    await waitForContainerReady(baseUrl, creationId, access_token);
    logger.info(`[Instagram] Container listo, publicando: ${creationId}`);
  }

  return publishInstagramContainer(credentials, creationId);
}
