-- Migration 015: Business profile on campaigns + post_focus on posts
--
-- Business context (problem, differentiator, etc.) is captured once at the
-- campaign level instead of being repeated on every post. Each post only needs
-- one field (post_focus) describing what to highlight in that specific ad.
-- The five old columns on posts are retained for backward compatibility with
-- posts that were created before this migration.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS business_problem TEXT,
  ADD COLUMN IF NOT EXISTS differentiator   TEXT,
  ADD COLUMN IF NOT EXISTS ideal_client     TEXT,
  ADD COLUMN IF NOT EXISTS concrete_result  TEXT,
  ADD COLUMN IF NOT EXISTS client_pain      TEXT;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_focus TEXT;
