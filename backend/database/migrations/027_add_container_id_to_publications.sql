-- ── 027: Persistir el container_id (creation_id) de Instagram ──────────────
-- Hoy publishToInstagram crea el container y espera de forma síncrona
-- (waitForContainerReady, hasta 5 min) sin guardar el creationId en ningún
-- lado — si el timeout se cumple antes de llegar a media_publish, el ID se
-- pierde y hay que rescatarlo de los logs a mano (pasó en producción).
--
-- Esta columna permite guardar el container_id apenas se crea y reemplazar
-- la espera bloqueante por polling asíncrono vía pg-boss (instagram-check-status
-- en publishPost.job.ts), mismo rol que post_id ya cumple para el publish_id
-- transaccional de TikTok antes de que tiktok-check-status confirme el ID final.

ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS container_id VARCHAR(255);
