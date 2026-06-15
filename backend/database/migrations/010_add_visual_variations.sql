-- Visual variations: 4 AI-generated options the client picks from before publishing

CREATE TABLE IF NOT EXISTS visual_variations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            UUID        NOT NULL REFERENCES campaigns(id)  ON DELETE CASCADE,
  strategy_id            UUID        NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  position               SMALLINT    NOT NULL CHECK (position BETWEEN 1 AND 4),
  url                    TEXT,
  type                   VARCHAR(10) NOT NULL DEFAULT 'image',   -- 'image' | 'video'
  status                 VARCHAR(20) NOT NULL DEFAULT 'generating', -- 'generating' | 'ready' | 'failed'
  visual_concept_variant TEXT,
  selected               BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, position)
);

CREATE INDEX IF NOT EXISTS idx_visual_variations_campaign ON visual_variations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_visual_variations_strategy ON visual_variations(strategy_id);
