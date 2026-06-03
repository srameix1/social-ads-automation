-- Perfil de negocio de cada cliente (1:1 con users)
CREATE TABLE IF NOT EXISTS client_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name    VARCHAR(255) NOT NULL,
  description      TEXT,
  photo_1_url      VARCHAR(500),
  photo_2_url      VARCHAR(500),
  photo_3_url      VARCHAR(500),
  setup_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_client_profiles_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles(user_id);

CREATE TRIGGER trg_client_profiles_updated_at
  BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
