-- Plan de servicio y campos de identidad de marca del cliente
-- basic ($97/mes) | professional ($197/mes) | premium ($397/mes)

CREATE TYPE service_plan AS ENUM ('basic', 'professional', 'premium');

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS plan                 service_plan NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS brand_logo_url       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS brand_primary_color  VARCHAR(7),    -- hex: #FF5733
  ADD COLUMN IF NOT EXISTS brand_secondary_color VARCHAR(7),
  ADD COLUMN IF NOT EXISTS brand_font           VARCHAR(100);  -- nombre de fuente

CREATE INDEX IF NOT EXISTS idx_client_profiles_plan ON client_profiles(plan);
