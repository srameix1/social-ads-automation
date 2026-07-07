-- Sistema de cortesía: acceso completo y gratuito a un plan por tiempo
-- limitado, otorgado manualmente por un admin (partners, pruebas extendidas,
-- casos de soporte). Mientras is_courtesy=TRUE y courtesy_expires_at no ha
-- vencido, el cliente opera con las features de courtesy_plan sin pagar y
-- sin límite de posts. Un job diario revoca cortesías vencidas.

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS is_courtesy         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS courtesy_plan        service_plan,
  ADD COLUMN IF NOT EXISTS courtesy_expires_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_profiles_courtesy_expires
  ON client_profiles(courtesy_expires_at)
  WHERE is_courtesy = TRUE;
