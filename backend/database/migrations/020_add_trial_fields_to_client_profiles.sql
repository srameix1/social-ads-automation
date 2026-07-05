-- Sistema de trial: los registros nuevos entran automáticamente en modo
-- prueba (saltan selección de plan y modalidad) hasta agotar sus posts
-- de prueba o convertir a un plan pago vía /select-plan.

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS is_trial          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_posts_limit INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS posts_used        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_notes       TEXT,
  ADD COLUMN IF NOT EXISTS registration_ip   VARCHAR(45);

-- Clientes existentes (registrados antes de este cambio) nunca son trial.
-- Ya cubierto por el DEFAULT FALSE de arriba (Postgres retro-llena columnas
-- nuevas con su default), se deja explícito para que quede documentado.
UPDATE client_profiles SET is_trial = FALSE WHERE is_trial IS NOT FALSE;

CREATE INDEX IF NOT EXISTS idx_client_profiles_registration_ip ON client_profiles(registration_ip);
