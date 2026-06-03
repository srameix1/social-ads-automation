-- Credenciales de redes sociales cifradas con AES-256-GCM
-- Cada fila = una plataforma de un cliente
-- encrypted_data: JSON cifrado  |  iv: vector de inicialización  |  auth_tag: tag GCM
CREATE TABLE IF NOT EXISTS client_credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform       VARCHAR(50) NOT NULL
                   CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  encrypted_data TEXT NOT NULL,
  iv             VARCHAR(64) NOT NULL,
  auth_tag       VARCHAR(64) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un cliente tiene una sola entrada por plataforma
  CONSTRAINT uq_client_credentials_platform UNIQUE (client_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_client_credentials_client_id ON client_credentials(client_id);

CREATE TRIGGER trg_client_credentials_updated_at
  BEFORE UPDATE ON client_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
