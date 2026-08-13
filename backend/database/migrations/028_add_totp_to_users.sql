-- 2FA (TOTP) opcional para cuentas admin.
-- totp_secret se guarda cifrado con AES-256-GCM (utils/encryption.ts, mismo
-- mecanismo que client_credentials.encrypted_data) — iv+authTag+ciphertext
-- concatenados en un solo string ("iv:authTag:encrypted", ~122 caracteres
-- para un secreto típico de 32). TEXT en vez de VARCHAR(N) para no atarse a
-- un tamaño fijo, igual que encrypted_data en client_credentials.
-- totp_backup_codes guarda HASHES (bcrypt), nunca los códigos en texto
-- plano — mismo mecanismo que password_hash. El texto plano sólo existe
-- una vez, en la respuesta de POST /api/auth/2fa/verify-setup.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];
