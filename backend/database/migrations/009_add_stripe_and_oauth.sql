-- Stripe billing + OAuth token refresh support

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pending_oauth_data        JSONB,
  ADD COLUMN IF NOT EXISTS pending_oauth_expires_at  TIMESTAMPTZ;

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subscription_status      VARCHAR(50) NOT NULL DEFAULT 'inactive';

-- Token expiry + refresh token for TikTok (60-day for Meta page tokens is handled separately)
ALTER TABLE client_credentials
  ADD COLUMN IF NOT EXISTS token_expires_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted    TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_iv           VARCHAR(32),
  ADD COLUMN IF NOT EXISTS refresh_token_tag          VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer        ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON client_profiles(stripe_subscription_id);
