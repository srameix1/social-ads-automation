-- ── 013: Updated plan limits + post format column ─────────────────────────

-- 1. Add reel_quota column to plan_limits
ALTER TABLE plan_limits
  ADD COLUMN IF NOT EXISTS reel_quota INTEGER NOT NULL DEFAULT 0;

-- 2. Update plan values
UPDATE plan_limits
SET max_posts_per_campaign = 20,
    can_generate_video     = FALSE,
    can_generate_reel      = FALSE,
    reel_quota             = 0
WHERE plan = 'basic';

UPDATE plan_limits
SET max_posts_per_campaign = 24,
    can_generate_video     = TRUE,
    can_generate_reel      = FALSE,
    reel_quota             = 0
WHERE plan = 'professional';

UPDATE plan_limits
SET max_posts_per_campaign = 30,
    can_generate_video     = TRUE,
    can_generate_reel      = TRUE,
    reel_quota             = 8
WHERE plan = 'premium';

-- 3. Add format column to posts
--    Values: 'image' | 'animated_video' | 'reel'
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS format VARCHAR(20) NOT NULL DEFAULT 'image';
