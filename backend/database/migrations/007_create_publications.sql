-- Resultado de publicar en cada red social
CREATE TYPE publication_status AS ENUM ('pending', 'published', 'failed');

CREATE TABLE IF NOT EXISTS publications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  strategy_id     UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  media_asset_id  UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  platform        VARCHAR(50) NOT NULL,
  status          publication_status NOT NULL DEFAULT 'pending',
  post_id         VARCHAR(255),
  post_url        TEXT,
  error_message   TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publications_campaign_id ON publications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_publications_strategy_id ON publications(strategy_id);
CREATE INDEX IF NOT EXISTS idx_publications_status      ON publications(status);

CREATE TRIGGER trg_publications_updated_at
  BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
