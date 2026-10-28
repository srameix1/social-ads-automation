-- Password reset: only the SHA-256 hash of the token is stored, never the
-- raw token, so a database read alone cannot reset a password. The token
-- is single-use and short-lived (the service sets a 60-minute expiry).
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users (reset_token_hash);
