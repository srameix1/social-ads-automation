-- ── 016: Overlay options per post ────────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS overlay_logo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overlay_copy BOOLEAN NOT NULL DEFAULT FALSE;
