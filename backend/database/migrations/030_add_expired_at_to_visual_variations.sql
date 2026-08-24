-- ── 030: Marca de expiración para visual_variations ─────────────────────────
-- cleanupOldFiles (backend/src/jobs/cleanupVideos.job.ts) borra archivos de
-- uploads/videos/ y uploads/variations/ a los 7 días (política documentada en
-- /privacy). Hasta ahora eso dejaba `url` apuntando a un archivo ya borrado
-- (link roto en el frontend). expired_at registra cuándo se borró el archivo
-- para que el frontend pueda mostrar un estado explícito en vez de una
-- imagen/video roto. NULL = no expirado (default). No se toca `url`.

ALTER TABLE visual_variations
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
