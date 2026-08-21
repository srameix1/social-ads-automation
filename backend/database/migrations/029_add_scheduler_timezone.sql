-- ── 029: Scheduler real para delivery_mode='automatic' ─────────────────────
-- 1. Timezone IANA del cliente, para convertir la hora local elegida en el
--    formulario a un instante UTC real antes de encolar el job de publicación.
ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York';

-- 2. scheduled_date pasa de DATE a TIMESTAMPTZ para poder programar a la hora
--    exacta, no solo al día. USING interpreta cualquier valor DATE existente
--    como medianoche UTC (no hay filas con esta columna poblada todavía, pero
--    la conversión queda correcta y explícita para cuando las haya).
ALTER TABLE posts
  ALTER COLUMN scheduled_date TYPE TIMESTAMPTZ
  USING (scheduled_date::timestamp AT TIME ZONE 'UTC');
