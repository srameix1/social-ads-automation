-- ── 026: Índice único parcial para publications activas por post+plataforma ─
-- Refuerza a nivel de base de datos la idempotencia de enqueuePublishJobs()
-- (backend/src/jobs/publishPost.job.ts): aunque la app ya chequea con un
-- SELECT si existe una publication no-terminal-fallida antes de insertar,
-- ese chequeo tiene una ventana de carrera entre dos confirmPost() casi
-- simultáneos para el mismo post. Este índice hace que un segundo INSERT
-- para (internal_post_id, platform) mientras ya hay una fila 'pending',
-- 'processing' o 'published' viole la restricción de unicidad — el INSERT
-- usa ON CONFLICT DO NOTHING para tratarlo como no-op, no como error.
--
-- No se agregó directamente a la migración 025 porque esa migración ya
-- pudo haberse ejecutado (queda registrada por nombre de archivo en
-- schema_migrations); editarla ahora no la re-correría en un entorno donde
-- ya se aplicó.

CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_post_platform_active
  ON publications (internal_post_id, platform)
  WHERE status IN ('pending', 'processing', 'published');
