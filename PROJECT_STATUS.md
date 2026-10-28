# Estado actual — SpotFlow / social-ads-automation

Actualizado: 2026-10-28. Rama de trabajo `spotflow-critico` (local, SIN push, SIN despliegue).

## Stack

- Frontend: Next.js 14, React 18, TypeScript y Tailwind CSS.
- Backend: Node.js, Express y TypeScript; producción usa una imagen Node 22 Alpine.
- Datos y trabajos: PostgreSQL (producción 17.11, servicio EasyPanel `spotflow-db`, base `social_ads_db`), `pg` y `pg-boss`.
- EasyPanel en `https://panel.spotflow.pro`; backend en `api.spotflow.pro`. `spotflow.app` está aparcado y NO es la página del producto.

## Bloque crítico 2026-10-28 (en `spotflow-critico`, base `f71e9ba`)

- LANDING: `frontend/app/page.tsx` ya no redirige a `/login`. Es una landing pública real, visual y distinta de las de otros productos: hero con collage de publicaciones de ejemplo creadas con IA (etiquetadas como ejemplos, no resultados), 3 pasos simples, ejemplo de publicación, aclaración de publicación orgánica (no anuncio pagado, sin presupuesto de anuncios, sin promesas de ventas o resultados), registro gratis sin plazos ni precios inventados, enlaces a `/privacy` y `/terms`. Completa en móvil. i18n ES/EN/PT. `/login` intacto; el middleware deja pasar `/` a visitantes y redirige a usuarios con sesión a su panel.
- RECUPERAR CONTRASEÑA: `POST /api/auth/forgot-password` (respuesta genérica, sin enumerar cuentas; límite 3/15 min) y `POST /api/auth/reset-password`. Solo se guarda el hash SHA-256 del token, expira en 60 minutos, un solo uso, correo con Resend. Páginas `/forgot-password` y `/reset-password`, con enlace desde `/login`. Migración `031`. Limitación honesta: las sesiones JWT ya iniciadas no se revocan con el cambio (vencen a los 7 días).
- ANALÍTICA BÁSICA: `GET /api/campaigns/:campaignId/insights` (con `?refresh=1`), cacheada 6 horas en la tabla nueva `publication_insights` (migración `032`) y mostrada en la página de la campaña. Facebook e Instagram: alcance (cuando el permiso lo permite), me gusta, comentarios y compartidos, leídos con los tokens ya guardados. TikTok: marcado como no disponible, porque los scopes actuales (`user.info.basic, video.publish, video.upload`) no incluyen lectura de estadísticas (haría falta algo como `video.list`); NO se cambiaron scopes.
- Precios y planes sin cambios ($97/$197/$397). Sin secretos en código.

## Verificación hecha en esta sesión (local, sin producción)

- Backend `tsc --noEmit`: OK. Frontend `tsc --noEmit` y `next build`: OK (28 rutas; `/`, `/forgot-password` y `/reset-password` como estáticas).
- Jest NO pudo correrse aquí: no hay base Postgres de pruebas ni `.env.test.local` en este entorno (falla antes de ejecutar, por `JWT_SECRET` faltante). La prueba nueva `backend/test/auth/passwordReset.test.ts` sigue el patrón existente y debe correrse donde exista la base de test.
- Pendiente de Santiago antes de cualquier push/Rebuild: revisar este diff, correr migraciones 031 y 032 en producción, probar en vivo forgot-password con un correo real, publicar una campaña y pulsar Actualizar en Resultados, y confirmar el dominio real del frontend en EasyPanel.

## Pendientes anteriores que siguen vigentes

- 2FA en EasyPanel, respaldo de uploads, custodia de `ENCRYPTION_KEY` fuera del VPS, advertencia rclone/Google Drive 2026, y dividir `contentGeneration.service.ts` (3,233 líneas) en una fase posterior, no en este bloque.
