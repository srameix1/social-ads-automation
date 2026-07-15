-- ── 023: Video hook per strategy ─────────────────────────────────────────────
-- Short AI-generated hook (8-10 words) for video overlay text, separate from
-- copy_text (which stays the full ad copy used for the post caption).

ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS video_hook TEXT;
