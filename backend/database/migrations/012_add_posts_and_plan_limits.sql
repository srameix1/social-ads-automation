-- ── 012: Monthly post model + plan limits ─────────────────────────────────

-- 1. Add month context and per-campaign post cap to campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS month_year VARCHAR(7),
  ADD COLUMN IF NOT EXISTS max_posts  INTEGER NOT NULL DEFAULT 20;

-- Backfill month_year from created_at for existing rows
UPDATE campaigns SET month_year = TO_CHAR(created_at, 'YYYY-MM') WHERE month_year IS NULL;

-- 2. Individual post lifecycle
CREATE TYPE post_status AS ENUM (
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed'
);

CREATE TABLE IF NOT EXISTS posts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID        NOT NULL REFERENCES campaigns(id)         ON DELETE CASCADE,
  strategy_id         UUID        REFERENCES strategies(id)                  ON DELETE SET NULL,
  visual_variation_id UUID        REFERENCES visual_variations(id)           ON DELETE SET NULL,
  scheduled_date      DATE,
  status              post_status NOT NULL DEFAULT 'draft',
  platform            VARCHAR(50) NOT NULL DEFAULT '',
  published_at        TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_campaign_id  ON posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_status        ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled     ON posts(scheduled_date);

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Admin-configurable limits per service plan
CREATE TABLE IF NOT EXISTS plan_limits (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  plan                    service_plan NOT NULL UNIQUE,
  max_posts_per_campaign  INTEGER      NOT NULL DEFAULT 20,
  can_upload_photos       BOOLEAN      NOT NULL DEFAULT TRUE,
  can_generate_video      BOOLEAN      NOT NULL DEFAULT FALSE,
  can_generate_reel       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_plan_limits_updated_at
  BEFORE UPDATE ON plan_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO plan_limits (plan, max_posts_per_campaign, can_upload_photos, can_generate_video, can_generate_reel)
VALUES
  ('basic',        20, TRUE, FALSE, FALSE),
  ('professional', 20, TRUE, TRUE,  FALSE),
  ('premium',      22, TRUE, TRUE,  TRUE)
ON CONFLICT (plan) DO NOTHING;
