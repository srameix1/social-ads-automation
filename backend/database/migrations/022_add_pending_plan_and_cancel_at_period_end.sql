-- Separa "elegir un plan" de "pagar un plan": pending_plan guarda la
-- intención mientras el cliente está en Stripe Checkout; el plan real
-- (plan, plan_selected_at, is_trial) solo se activa cuando llega el
-- webhook checkout.session.completed confirmando el pago.
--
-- cancel_at_period_end refleja que la suscripción seguirá activa hasta
-- el fin del período actual pero no se renovará (cancelación programada).

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS pending_plan         service_plan,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
