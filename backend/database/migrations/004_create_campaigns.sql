-- Ciclo de vida de una campaña publicitaria
CREATE TYPE campaign_status AS ENUM (
  'draft',              -- Recién creada por el cliente
  'generating',         -- Claude API generando estrategias
  'pending_selection',  -- Esperando que el cliente escoja una estrategia
  'creating_media',     -- NanaBanana generando imágenes/video
  'publishing',         -- Publicando en redes sociales
  'completed',          -- Publicado exitosamente en todas las plataformas
  'failed'              -- Error en algún paso (ver error_message)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  objective       TEXT,
  target_audience TEXT,
  platforms       VARCHAR(20)[] NOT NULL DEFAULT '{}',
  status          campaign_status NOT NULL DEFAULT 'draft',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status    ON campaigns(status);

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
