-- ── 014: Restructure campaigns and posts model ──────────────────────────────

-- 1. Campaigns: remove AI-generation columns, add date range
ALTER TABLE campaigns ALTER COLUMN status DROP DEFAULT;
ALTER TABLE campaigns ALTER COLUMN status TYPE VARCHAR(30);
DROP TYPE IF EXISTS campaign_status;
ALTER TABLE campaigns
  DROP COLUMN IF EXISTS objective,
  DROP COLUMN IF EXISTS target_audience,
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS status;
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE;

-- 2. Posts: add per-post wizard fields
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS problem         TEXT,
  ADD COLUMN IF NOT EXISTS differentiator  TEXT,
  ADD COLUMN IF NOT EXISTS ideal_client    TEXT,
  ADD COLUMN IF NOT EXISTS concrete_result TEXT,
  ADD COLUMN IF NOT EXISTS client_pain     TEXT,
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS platforms       VARCHAR(20)[] NOT NULL DEFAULT '{}';

-- 3. Strategies: replace campaign_id with post_id
ALTER TABLE strategies
  DROP CONSTRAINT IF EXISTS uq_strategies_position,
  DROP CONSTRAINT IF EXISTS strategies_campaign_id_fkey;
DROP INDEX IF EXISTS idx_strategies_campaign_id;
ALTER TABLE strategies DROP COLUMN IF EXISTS campaign_id;
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_strategies_post_id ON strategies(post_id);
ALTER TABLE strategies
  ADD CONSTRAINT uq_strategies_post_position UNIQUE (post_id, position);

-- 4. Visual_variations: replace campaign_id with post_id
ALTER TABLE visual_variations
  DROP CONSTRAINT IF EXISTS visual_variations_campaign_id_position_key,
  DROP CONSTRAINT IF EXISTS visual_variations_campaign_id_fkey;
DROP INDEX IF EXISTS idx_visual_variations_campaign;
ALTER TABLE visual_variations DROP COLUMN IF EXISTS campaign_id;
ALTER TABLE visual_variations ALTER COLUMN strategy_id DROP NOT NULL;
ALTER TABLE visual_variations
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_visual_variations_post_id ON visual_variations(post_id);
ALTER TABLE visual_variations
  ADD CONSTRAINT uq_visual_variations_post_position UNIQUE (post_id, position);
