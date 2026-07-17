/**
 * Instagram Graph API — publica imagen o video en la cuenta del cliente.
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * Credenciales requeridas (se guardan cifradas en client_credentials):
 *   access_token:          User Access Token con permisos instagram_business_basic, instagram_business_content_publish
 *   instagram_account_id:  ID de la cuenta de Instagram (obtenido vía /me/accounts)
 */

import { logger } from '../utils/logger';

const GRAPH_URL = 'https://graph.facebook.com/v18.0';

export interface InstagramCredentials {
  access_token:          string;
  instagram_account_id:  string;
}

export interface PublishResult {
  postId:  string;
  postUrl: string;
}

async function waitForContainerReady(
  baseUrl:      string,
  creationId:   string,
  access_token: string,
): Promise<void> {
  const maxAttempts = 24; // ~2 minutos con 5s de espera
  for (let i = 0; i < maxAttempts; i++) {
    const res  = await fetch(`${baseUrl}/${creationId}?fields=status_code&access_token=${access_token}`);
    const data = await res.json() as { status_code?: string };
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram container processing failed: ${JSON.stringify(data)}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Instagram container timeout esperando FINISHED (2 min)');
}

export async function publishToInstagram(
  credentials: InstagramCredentials,
  mediaUrl:    string,
  caption:     string,
): Promise<PublishResult> {
  const { access_token, instagram_account_id } = credentials;
  const baseUrl = `${GRAPH_URL}/${instagram_account_id}`;
  const isVideo = /\.(mp4|mov)$/i.test(mediaUrl);

  // Paso 1: Crear container de media
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

  if (isVideo) {
    logger.info(`[Instagram] Esperando procesamiento del container: ${creationId}`);
    await waitForContainerReady(baseUrl, creationId, access_token);
    logger.info(`[Instagram] Container listo, publicando: ${creationId}`);
  }

  // Paso 2: Publicar el container
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
