import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { query, queryOne } from '../../config/database';
import { encrypt } from '../../utils/encryption';
import { logger } from '../../utils/logger';

const FB_GRAPH = 'https://graph.facebook.com/v18.0';
// Instagram scopes: instagram_business_basic e instagram_business_content_publish
// funcionan en modo Development para admins/testers de la app sin necesitar
// App Review. Al aprobarse el Review, funcionan automáticamente para clientes reales.
const FB_SCOPE = 'pages_manage_posts,pages_read_engagement,pages_show_list,business_management,instagram_business_basic,instagram_business_content_publish';
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
}

interface PendingPage extends FacebookPage {}

// pending_oauth_data is a JSONB column: node-postgres already deserializes it
// to an object/array, so JSON.parse() only applies when the driver returned raw text.
function parsePendingPages(raw: string | PendingPage[]): PendingPage[] {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// ── Facebook ───────────────────────────────────────────────────────────────

export function buildFacebookAuthUrl(userId: string): string {
  const state = jwt.sign(
    { userId, action: 'facebook_connect' },
    env.JWT_SECRET,
    { expiresIn: '10m' },
  );
  const params = new URLSearchParams({
    client_id:     env.FACEBOOK_APP_ID,
    redirect_uri:  `${env.BACKEND_URL}/api/oauth/facebook/callback`,
    scope:         FB_SCOPE,
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function handleFacebookCallback(
  code: string,
  stateStr: string,
): Promise<string> {
  const state = jwt.verify(stateStr, env.JWT_SECRET) as { userId: string; action: string };
  if (state.action !== 'facebook_connect') throw new Error('Invalid OAuth state');
  const { userId } = state;

  const redirectUri = `${env.BACKEND_URL}/api/oauth/facebook/callback`;

  // Exchange code → short-lived user token
  const tokenRes = await fetch(
    `${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id:     env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      redirect_uri:  redirectUri,
      code,
    }),
  );
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Facebook token exchange failed: ${err}`);
  }
  const { access_token: shortToken } = await tokenRes.json() as { access_token: string };

  // Exchange short-lived → long-lived (60 days)
  const llRes = await fetch(
    `${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type:        'fb_exchange_token',
      client_id:         env.FACEBOOK_APP_ID,
      client_secret:     env.FACEBOOK_APP_SECRET,
      fb_exchange_token: shortToken,
    }),
  );
  if (!llRes.ok) throw new Error('Failed to exchange for long-lived Facebook token');
  const { access_token: longToken } = await llRes.json() as { access_token: string };

  // Get user's pages
  const pagesRes = await fetch(`${FB_GRAPH}/me/accounts?access_token=${longToken}&fields=id,name,access_token`);
  if (!pagesRes.ok) throw new Error('Failed to fetch Facebook pages');
  const { data: pages } = await pagesRes.json() as { data: FacebookPage[] };

  if (pages.length === 0) {
    throw new Error('No se encontraron Páginas de Facebook. Crea una Página de Facebook para tu negocio primero.');
  }

  if (pages.length === 1) {
    await storeFacebookPage(userId, pages[0]);
    return `${env.FRONTEND_URL}/connect?connected=facebook`;
  }

  // Multiple pages: store pending and redirect to selector
  await query(
    `UPDATE users SET pending_oauth_data = $1, pending_oauth_expires_at = NOW() + INTERVAL '10 minutes' WHERE id = $2`,
    [JSON.stringify(pages.map(p => ({ id: p.id, name: p.name, access_token: p.access_token }))), userId],
  );
  const selectionToken = jwt.sign(
    { userId, action: 'facebook_page_select' },
    env.JWT_SECRET,
    { expiresIn: '10m' },
  );
  return `${env.FRONTEND_URL}/connect/facebook/pages?token=${selectionToken}`;
}

export async function getPendingFacebookPages(token: string): Promise<Array<{ id: string; name: string }>> {
  const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; action: string };
  if (payload.action !== 'facebook_page_select') throw new Error('Token inválido');

  const row = await queryOne<{ pending_oauth_data: string | PendingPage[]; pending_oauth_expires_at: string }>(
    'SELECT pending_oauth_data, pending_oauth_expires_at FROM users WHERE id = $1',
    [payload.userId],
  );
  if (!row?.pending_oauth_data) throw new Error('No hay páginas pendientes de selección');
  if (new Date(row.pending_oauth_expires_at) < new Date()) throw new Error('La selección expiró. Vuelve a conectar Facebook.');

  const pages = parsePendingPages(row.pending_oauth_data);
  return pages.map(p => ({ id: p.id, name: p.name }));
}

export async function selectFacebookPage(token: string, pageId: string): Promise<void> {
  const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; action: string };
  if (payload.action !== 'facebook_page_select') throw new Error('Token inválido');

  const row = await queryOne<{ pending_oauth_data: string | PendingPage[]; pending_oauth_expires_at: string }>(
    'SELECT pending_oauth_data, pending_oauth_expires_at FROM users WHERE id = $1',
    [payload.userId],
  );
  if (!row?.pending_oauth_data) throw new Error('No hay páginas pendientes');
  if (new Date(row.pending_oauth_expires_at) < new Date()) throw new Error('La selección expiró. Vuelve a conectar Facebook.');

  const pages = parsePendingPages(row.pending_oauth_data);
  const page = pages.find(p => p.id === pageId);
  if (!page) throw new Error('Página no encontrada en la selección pendiente');

  await storeFacebookPage(payload.userId, page);

  await query(
    'UPDATE users SET pending_oauth_data = NULL, pending_oauth_expires_at = NULL WHERE id = $1',
    [payload.userId],
  );
}

async function storeFacebookPage(userId: string, page: FacebookPage): Promise<void> {
  // Get Instagram Business Account linked to this page
  let instagramAccountId: string | null = null;
  try {
    const igRes = await fetch(
      `${FB_GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
    );
    const igDataRaw = await igRes.text();
    logger.info('[IG Debug] Raw response', { status: igRes.status, body: igDataRaw, pageId: page.id });
    if (igRes.ok) {
      const igData = JSON.parse(igDataRaw) as { instagram_business_account?: { id: string } };
      instagramAccountId = igData.instagram_business_account?.id ?? null;
    }
  } catch (err) {
    logger.warn('Could not fetch Instagram Business Account', { pageId: page.id, error: (err as Error).message });
  }

  // Facebook credentials
  const fbEnc = encrypt(JSON.stringify({ page_access_token: page.access_token, page_id: page.id }));
  await query(
    `INSERT INTO client_credentials (client_id, platform, encrypted_data, iv, auth_tag)
     VALUES ($1, 'facebook', $2, $3, $4)
     ON CONFLICT (client_id, platform) DO UPDATE
       SET encrypted_data = EXCLUDED.encrypted_data, iv = EXCLUDED.iv,
           auth_tag = EXCLUDED.auth_tag, updated_at = NOW()`,
    [userId, fbEnc.encrypted, fbEnc.iv, fbEnc.authTag],
  );

  // Instagram credentials (auto-linked via Facebook page token)
  if (instagramAccountId) {
    const igEnc = encrypt(JSON.stringify({ access_token: page.access_token, instagram_account_id: instagramAccountId }));
    await query(
      `INSERT INTO client_credentials (client_id, platform, encrypted_data, iv, auth_tag)
       VALUES ($1, 'instagram', $2, $3, $4)
       ON CONFLICT (client_id, platform) DO UPDATE
         SET encrypted_data = EXCLUDED.encrypted_data, iv = EXCLUDED.iv,
             auth_tag = EXCLUDED.auth_tag, updated_at = NOW()`,
      [userId, igEnc.encrypted, igEnc.iv, igEnc.authTag],
    );
  }

  logger.info('Facebook/Instagram credentials stored via OAuth', {
    userId, pageId: page.id, instagramLinked: !!instagramAccountId,
  });

  await activateFacebookServicePeriod(userId);
}

async function activateFacebookServicePeriod(userId: string): Promise<void> {
  await query(
    `UPDATE client_profiles
     SET service_period_started_at = COALESCE(service_period_started_at, NOW()),
         facebook_grace_period_ends_at = COALESCE(facebook_grace_period_ends_at, NOW() + INTERVAL '7 days')
     WHERE user_id = $1 AND delivery_mode = 'automatic'`,
    [userId],
  );
}

// ── TikTok ─────────────────────────────────────────────────────────────────

export function buildTikTokAuthUrl(userId: string): string {
  const codeVerifier  = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const state = jwt.sign(
    { userId, action: 'tiktok_connect', codeVerifier },
    env.JWT_SECRET,
    { expiresIn: '10m' },
  );

  const params = new URLSearchParams({
    client_key:            env.TIKTOK_CLIENT_KEY,
    scope:                 'user.info.basic,video.publish,video.upload',
    response_type:         'code',
    redirect_uri:          `${env.BACKEND_URL}/api/oauth/tiktok/callback`,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${TIKTOK_AUTH_URL}?${params}`;
}

export async function handleTikTokCallback(code: string, stateStr: string): Promise<void> {
  const state = jwt.verify(stateStr, env.JWT_SECRET) as {
    userId: string; action: string; codeVerifier: string;
  };
  if (state.action !== 'tiktok_connect') throw new Error('Invalid OAuth state');
  const { userId, codeVerifier } = state;

  const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key:    env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  `${env.BACKEND_URL}/api/oauth/tiktok/callback`,
      code_verifier: codeVerifier,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`TikTok token exchange failed: ${err}`);
  }
  const tokenData = await tokenRes.json() as {
    access_token:       string;
    refresh_token:      string;
    open_id:            string;
    expires_in:         number;
    refresh_expires_in: number;
  };
  const { access_token, refresh_token, open_id, expires_in } = tokenData;

  const credsEnc   = encrypt(JSON.stringify({ access_token, open_id }));
  const refreshEnc = encrypt(refresh_token);
  const expiresAt  = new Date(Date.now() + expires_in * 1000);

  await query(
    `INSERT INTO client_credentials
       (client_id, platform, encrypted_data, iv, auth_tag,
        token_expires_at, refresh_token_encrypted, refresh_token_iv, refresh_token_tag)
     VALUES ($1, 'tiktok', $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (client_id, platform) DO UPDATE
       SET encrypted_data = EXCLUDED.encrypted_data, iv = EXCLUDED.iv,
           auth_tag = EXCLUDED.auth_tag, token_expires_at = EXCLUDED.token_expires_at,
           refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
           refresh_token_iv = EXCLUDED.refresh_token_iv,
           refresh_token_tag = EXCLUDED.refresh_token_tag,
           updated_at = NOW()`,
    [userId, credsEnc.encrypted, credsEnc.iv, credsEnc.authTag,
     expiresAt, refreshEnc.encrypted, refreshEnc.iv, refreshEnc.authTag],
  );

  logger.info('TikTok credentials stored via OAuth', { userId, openId: open_id });
}

// ── Disconnect ─────────────────────────────────────────────────────────────

export async function disconnectPlatform(userId: string, platform: string): Promise<void> {
  // Disconnecting Facebook also removes Instagram (they share the token)
  if (platform === 'facebook') {
    await query(
      `DELETE FROM client_credentials WHERE client_id = $1 AND platform IN ('facebook', 'instagram')`,
      [userId],
    );
  } else {
    await query(
      'DELETE FROM client_credentials WHERE client_id = $1 AND platform = $2',
      [userId, platform],
    );
  }

  logger.info('Platform disconnected', { userId, platform });
}
