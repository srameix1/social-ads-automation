-- Añade la modalidad de publicación y periodos de servicio/gracia del cliente

CREATE TYPE delivery_mode AS ENUM ('automatic', 'manual');

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS delivery_mode delivery_mode,
  ADD COLUMN IF NOT EXISTS service_period_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facebook_grace_period_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_profiles_delivery_mode ON client_profiles(delivery_mode);
