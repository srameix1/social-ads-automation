import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedPayload {
  encrypted: string;
  iv:        string;
  authTag:   string;
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString('hex'),
    iv:        iv.toString('hex'),
    authTag:   cipher.getAuthTag().toString('hex'),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key      = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  return (
    decipher.update(payload.encrypted, 'hex', 'utf8') +
    decipher.final('utf8')
  );
}
