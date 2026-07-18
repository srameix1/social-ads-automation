-- ── 025: Soporte para cola persistente de publicación (pg-boss) ────────────
-- Hoy confirmPost() dispara la publicación automática con setImmediate()
-- (fire-and-forget): si el servidor se reinicia a mitad de una publicación,
-- la tarea se pierde sin rastro ni reintento. Este cambio prepara la tabla
-- para que la fila se cree ANTES de encolar el job (status 'pending'),
-- sobreviviendo cualquier reinicio.
--
-- Nota: `post_id` (VARCHAR) ya existía y guarda el ID que devuelve la red
-- social (Instagram media id, TikTok video id, etc.) — por eso la nueva FK
-- hacia posts(id) se llama `internal_post_id`, para no chocar con esa columna.

ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS internal_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pgboss_job_id    UUID;

CREATE INDEX IF NOT EXISTS idx_publications_internal_post_id ON publications(internal_post_id);

-- Estado intermedio entre 'pending' (encolado, sin intentar) y 'published'/'failed'
-- (terminal): un intento en curso, o —caso TikTok— esperando que la moderación
-- del video confirme el ID público real (puede tardar horas, ver tiktok-check-status).
ALTER TYPE publication_status ADD VALUE IF NOT EXISTS 'processing';
