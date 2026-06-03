-- ─────────────────────────────────────────────────────────────────
-- SEED: Datos de prueba
-- Ejecutar DESPUÉS de migrate.js, con: node seed.js
-- ─────────────────────────────────────────────────────────────────
-- Este archivo es referencia. El hash de bcrypt se genera en seed.js
-- para garantizar que sea válido.
--
-- Admin:   admin@social-ads.com   / Admin1234!
-- Cliente: cliente@prueba.com     / Test1234!
-- ─────────────────────────────────────────────────────────────────

-- Insertar admin (el hash se sobreescribe desde seed.js)
INSERT INTO users (id, email, password_hash, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@social-ads.com',
  '__HASH_PLACEHOLDER__',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insertar cliente de prueba
INSERT INTO users (id, email, password_hash, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'cliente@prueba.com',
  '__HASH_PLACEHOLDER__',
  'client'
) ON CONFLICT (email) DO NOTHING;

-- Perfil del cliente de prueba
INSERT INTO client_profiles (user_id, business_name, description, setup_completed)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Café del Valle',
  'Cafetería artesanal en el centro de la ciudad. Especialidad en café de origen, pasteles caseros y ambiente acogedor para trabajar o reunirse.',
  FALSE
) ON CONFLICT (user_id) DO NOTHING;
