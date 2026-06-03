-- Imágenes y videos generados por NanaBanana
CREATE TYPE asset_type   AS ENUM ('image', 'video');
CREATE TYPE asset_status AS ENUM ('pending', 'generating', 'ready', 'failed');

CREATE TABLE IF NOT EXISTS media_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  strategy_id         UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  type                asset_type   NOT NULL,
  status              asset_status NOT NULL DEFAULT 'pending',
  platform            VARCHAR(50)  NOT NULL,
  url                 TEXT,
  prompt_used         TEXT,
  nanabanana_job_id   VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_campaign_id  ON media_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_strategy_id  ON media_assets(strategy_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_status       ON media_assets(status);

CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
