ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;
