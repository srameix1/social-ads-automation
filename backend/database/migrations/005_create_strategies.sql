-- Las 3 estrategias generadas por Claude para cada campaña
CREATE TABLE IF NOT EXISTS strategies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  copy_text       TEXT NOT NULL,
  visual_concept  TEXT NOT NULL,
  tone            VARCHAR(100),
  target_hook     TEXT,
  position        INTEGER NOT NULL CHECK (position IN (1, 2, 3)),
  selected        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Solo una estrategia puede ser la seleccionada por campaña
  CONSTRAINT uq_strategies_position UNIQUE (campaign_id, position)
);

CREATE INDEX IF NOT EXISTS idx_strategies_campaign_id ON strategies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_strategies_selected    ON strategies(selected) WHERE selected = TRUE;
