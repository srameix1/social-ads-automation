/**
 * Facebook Graph API — publica imagen o post en la página del cliente.
 * Docs: https://developers.facebook.com/docs/pages-api/posts
 *
 * Credenciales requeridas (se guardan cifradas en client_credentials):
 *   page_access_token: Token de acceso de la página
 *   page_id:           ID de la página de Facebook
 */

import { logger } from '../utils/logger';

const GRAPH_URL = 'https://graph.facebook.com/v18.0';

export interface FacebookCredentials {
  page_access_token: string;
  page_id:           string;
}

export interface PublishResult {
  postId:  string;
  postUrl: string;
}

export async function publishToFacebook(
  credentials: FacebookCredentials,
  mediaUrl:    string,
  caption:     string,
): Promise<PublishResult> {
  const { page_access_token, page_id } = credentials;

  // Publicar imagen con mensaje
  const res = await fetch(`${GRAPH_URL}/${page_id}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:          mediaUrl,
      message:      caption,
      access_token: page_access_token,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message: string } };
    throw new Error(`Facebook publish error: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json() as { id: string; post_id?: string };
  const postId  = data.post_id ?? data.id;
  const postUrl = `https://www.facebook.com/${postId}`;

  logger.info('[Facebook] Publicado exitosamente:', postId);
  return { postId, postUrl };
}
