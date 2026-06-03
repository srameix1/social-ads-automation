import { query, queryOne } from '../../config/database';
import { encrypt, decrypt } from '../../utils/encryption';
import { createError } from '../../middleware/errorHandler';

type Platform = 'instagram' | 'tiktok' | 'facebook';

export interface CredentialStatus {
  platform:   Platform;
  connected:  boolean;
  updated_at: string | null;
}

export async function listCredentials(clientId: string): Promise<CredentialStatus[]> {
  const platforms: Platform[] = ['instagram', 'tiktok', 'facebook'];
  const rows = await query<{ platform: Platform; updated_at: string }>(
    'SELECT platform, updated_at FROM client_credentials WHERE client_id = $1',
    [clientId],
  );

  const connected = new Map(rows.map((r) => [r.platform, r.updated_at]));
  return platforms.map((p) => ({
    platform:   p,
    connected:  connected.has(p),
    updated_at: connected.get(p) ?? null,
  }));
}

export async function saveCredentials(
  clientId:    string,
  platform:    Platform,
  credentials: Record<string, string>,
): Promise<void> {
  const plaintext = JSON.stringify(credentials);
  const { encrypted, iv, authTag } = encrypt(plaintext);

  await query(
    `INSERT INTO client_credentials (client_id, platform, encrypted_data, iv, auth_tag)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (client_id, platform)
     DO UPDATE SET encrypted_data = EXCLUDED.encrypted_data,
                   iv             = EXCLUDED.iv,
                   auth_tag       = EXCLUDED.auth_tag,
                   updated_at     = NOW()`,
    [clientId, platform, encrypted, iv, authTag],
  );
}

export async function deleteCredentials(clientId: string, platform: Platform): Promise<void> {
  const result = await query(
    'DELETE FROM client_credentials WHERE client_id = $1 AND platform = $2 RETURNING id',
    [clientId, platform],
  );
  if (result.length === 0) throw createError('Credenciales no encontradas', 404);
}

export async function getDecryptedCredentials(
  clientId: string,
  platform: Platform,
): Promise<Record<string, string>> {
  const row = await queryOne<{ encrypted_data: string; iv: string; auth_tag: string }>(
    'SELECT encrypted_data, iv, auth_tag FROM client_credentials WHERE client_id = $1 AND platform = $2',
    [clientId, platform],
  );
  if (!row) throw createError(`No hay credenciales de ${platform} configuradas`, 404);

  const plaintext = decrypt({
    encrypted: row.encrypted_data,
    iv:        row.iv,
    authTag:   row.auth_tag,
  });

  return JSON.parse(plaintext) as Record<string, string>;
}
