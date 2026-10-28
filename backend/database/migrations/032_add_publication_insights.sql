-- Cached per-publication results. Insights are read on demand from the
-- platform and cached here so the client panel does not hit Meta on every
-- render; a refresh simply overwrites the row. Reach can be NULL when the
-- platform returns counts but not reach for the token's permissions.
CREATE TABLE IF NOT EXISTS publication_insights (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id     UUID NOT NULL UNIQUE REFERENCES publications(id) ON DELETE CASCADE,
  reach              INTEGER,
  likes              INTEGER,
  comments           INTEGER,
  shares             INTEGER,
  status             VARCHAR(20) NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available', 'unavailable', 'not_connected')),
  unavailable_reason TEXT,
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publication_insights_publication_id
  ON publication_insights(publication_id);
