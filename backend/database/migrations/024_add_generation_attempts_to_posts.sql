-- ── 024: Attempt counters for expensive content regeneration ───────────────
-- Cierra el hueco del botón "Anterior" del wizard: hoy no hay límite a
-- cuántas veces un cliente puede regenerar copy (Claude Haiku) o
-- imágenes (Gemini) para el mismo post.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS copy_generation_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visual_generation_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE plan_limits
  ADD COLUMN IF NOT EXISTS max_copy_attempts   INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_visual_attempts INTEGER NOT NULL DEFAULT 2;

UPDATE plan_limits SET max_copy_attempts = 5, max_visual_attempts = 2 WHERE plan = 'basic';
UPDATE plan_limits SET max_copy_attempts = 7, max_visual_attempts = 3 WHERE plan = 'professional';
UPDATE plan_limits SET max_copy_attempts = 9, max_visual_attempts = 4 WHERE plan = 'premium';
