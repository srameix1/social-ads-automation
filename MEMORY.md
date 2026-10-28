# Memory Index — social-ads-automation

## 2026-08-23 — Primer backup y restauración verificados en EasyPanel

Producción usa PostgreSQL 17.11 en el servicio `spotflow-db`, con la base `social_ads_db` y el usuario `social_ads_user`. EasyPanel generó correctamente el primer backup automático en Local Disk (`spotflow/spotflow-db/2026-08-23T00:52:05.550Z.sql.gz`, 13.9 kB). El respaldo se restauró con éxito en el servicio temporal aislado `spotflow-db-restore-test`: se comprobaron 11 tablas, con `users=2` y `client_profiles=2`; las tablas `campaigns`, `client_credentials`, `posts`, `publications`, `strategies` y `media_assets` tenían 0 registros. La prueba no alteró producción.

Quedan pendientes el almacenamiento externo al VPS, la confirmación del horario, zona horaria y retención, la custodia segura de `ENCRYPTION_KEY`, el respaldo de archivos multimedia, la revisión del acceso HTTP sin HTTPS a EasyPanel y la eliminación del servicio temporal cuando deje de ser necesario.

## 2026-08-23 — HTTPS y backup externo en Google Drive

EasyPanel quedó disponible mediante `https://panel.spotflow.pro`, con un registro DNS A que apunta al VPS. `social_ads_db` tiene dos backups automáticos: Local Disk y Google Drive mediante `spotflow-google-drive`. El backup externo se ejecutó manualmente con éxito y se verificó directamente en Google Drive el archivo `spotflow/spotflow-db/2026-08-23T02:46:57.947Z.sql.gz` (13.9 kB). La restauración ya había sido comprobada en una base temporal independiente y el servicio `spotflow-db-restore-test` fue eliminado.

Permanece la advertencia de que rclone usa un `client_id` compartido de Google Drive que dejará de funcionar durante 2026; se debe investigar una actualización de EasyPanel o un proveedor alternativo antes de que se interrumpan los backups.

## 2026-08-23 — Infraestructura de backup confirmada

EasyPanel opera en `https://panel.spotflow.pro`, cuyo registro DNS apunta al VPS. `social_ads_db` cuenta con backups automáticos en Local Disk y Google Drive mediante `spotflow-google-drive`; se verificó en Google Drive el archivo `spotflow/spotflow-db/2026-08-23T02:46:57.947Z.sql.gz` (13.9 kB). La restauración independiente recuperó 11 tablas, 2 usuarios y 2 perfiles, y después se eliminó `spotflow-db-restore-test`. Queda pendiente resolver la advertencia de rclone sobre el `client_id` compartido que dejará de funcionar durante 2026.

## 2026-08-23 — bcrypt actualizado y validado localmente

El backend se actualizó de bcrypt 5.1.1 a 6.0.0, conservando `@types/bcrypt`. Se comprobó la compatibilidad con un hash generado por bcrypt 5, el almacenamiento correcto de hashes durante el registro, el build, 35 tests de autenticación y la suite completa de 41 tests. `npm audit` quedó en 0 vulnerabilidades y desapareció la cadena vulnerable `bcrypt → node-pre-gyp → tar`. También se construyó y validó una imagen local con Node 22 Alpine y bcrypt 6. No hubo despliegue ni cambios en hashes de producción.

## 2026-08-23 — Cierre de infraestructura, seguridad y despliegue de bcrypt 6

### Coordinación de contexto

`AGENTS.md` quedó configurado para consultar `PROJECT_STATUS.md` como estado operativo breve y `MEMORY.md` como memoria histórica acumulativa. Se corrigieron las referencias antiguas a `PROJECT_MEMORY.md` sin cambiar la regla de consultar únicamente las secciones históricas necesarias.

### PostgreSQL, backups y restauración

Producción usa PostgreSQL 17.11 en EasyPanel, en el servicio `spotflow-db`, con la base `social_ads_db` y el usuario `social_ads_user`. El entorno local tiene una configuración distinta con PostgreSQL 15 y no debe utilizarse para inferir la versión de producción.

Se configuraron dos backups automáticos de `social_ads_db`: Local Disk y Google Drive mediante `spotflow-google-drive`. El primer intento falló porque el nombre de la base se configuró como `spotflow`; al corregirlo a `social_ads_db`, los respaldos funcionaron. Se verificaron el backup local `spotflow/spotflow-db/2026-08-23T00:52:05.550Z.sql.gz` y el backup externo `spotflow/spotflow-db/2026-08-23T02:46:57.947Z.sql.gz`, ambos de aproximadamente 13.9 kB. El archivo externo fue comprobado directamente en Google Drive.

Para probar recuperación real se creó temporalmente `spotflow-db-restore-test` con PostgreSQL 17. La copia se restauró sin modificar producción y se comprobaron 11 tablas: `users=2`, `client_profiles=2`, y `campaigns`, `client_credentials`, `posts`, `publications`, `strategies` y `media_assets` con 0 registros. PgWeb intentaba usar una base incorrecta, por lo que la verificación final se realizó directamente con `psql`. Después de la prueba se eliminó el servicio temporal.

### EasyPanel y despliegue

Se creó el DNS de `panel.spotflow.pro` apuntando al VPS y se comprobó el acceso HTTPS mediante `https://panel.spotflow.pro`. EasyPanel administra todos los proyectos del VPS, no únicamente SpotFlow. Queda por confirmar si continúa habilitada la opción Serve on IP address y, si corresponde, desactivarla después de validar acceso HTTPS estable. También queda pendiente configurar 2FA en EasyPanel.

El token de Deployment Trigger del backend fue rotado mediante Refresh Deploy Token; su valor no se guardó ni se documentó. Debe revisarse si alguna integración o webhook dependía del token anterior.

### bcrypt 6, validación y Git

bcrypt se actualizó de 5.1.1 a 6.0.0 conservando `@types/bcrypt`. La actualización eliminó `bcrypt → @mapbox/node-pre-gyp → tar`; `npm audit` terminó con 0 vulnerabilidades críticas, altas, moderadas o bajas. El build fue exitoso, aprobaron 35 pruebas de autenticación y las 41 pruebas de la suite completa. Se agregaron pruebas para verificar hashes generados con bcrypt 5 y para confirmar que el registro almacena contraseñas de forma segura. La imagen fue construida y comprobada con Node 22 Alpine y bcrypt 6.

El backend se desplegó correctamente en EasyPanel y se verificó el inicio de sesión en producción con una cuenta existente. La terminal no abrió con `/bin/bash` porque Alpine no incluye bash; esto no fue una falla del servicio.

El commit `3a91e51f1b504940f4fc302fe1f41be2f1c2645e` (`security: verify backups and upgrade bcrypt`) fue publicado en `main`, que quedó sincronizada con `origin/main`. Incluyó `AGENTS.md`, `PROJECT_STATUS.md`, `MEMORY.md`, los manifests del backend y las pruebas nuevas de bcrypt y registro. Los archivos locales previos, configuraciones privadas y artefactos multimedia no se incluyeron.

### Pendientes

- Resolver la advertencia de rclone: el `client_id` compartido de Google Drive dejará de funcionar durante 2026; investigar una actualización de EasyPanel o un proveedor alternativo.
- Confirmar horarios, zona horaria y retención efectiva de ambos backups.
- Custodiar `ENCRYPTION_KEY` fuera del VPS y fuera de Git, y respaldar `UPLOADS_DIR` y archivos multimedia.
- Confirmar y, si procede, deshabilitar el acceso de EasyPanel por IP; configurar 2FA en el panel.
- Revisar dependencias del token de despliegue anterior e investigar los errores históricos de firma de webhooks de Stripe sin asumir que continúan activos.
- Ejecutar una auditoría de seguridad; continuar la fase MEDIUM con headers, recuperación/restablecimiento de contraseña, paginación y más pruebas.
- Diseñar más adelante métricas y análisis y repetir la rotación general de tokens y credenciales antes del lanzamiento.

El próximo paso recomendado es iniciar una auditoría rápida de seguridad o implementar headers, dando prioridad paralela a 2FA en EasyPanel y a la continuidad de los backups externos.

## 2026-10-28 — Bloque crítico: landing, recuperar contraseña y analítica básica (rama spotflow-critico, sin push)

Landing pública real en `/` (antes solo redirigía a `/login`), con enfoque visual atrevido e imágenes de ejemplo con IA, en lenguaje simple, aclarando publicación orgánica sin anuncios pagos ni resultados prometidos, i18n ES/EN/PT, completa en móvil. Recuperar contraseña con token hasheado, 60 minutos, un solo uso, correo Resend y páginas nuevas. Analítica básica por campaña con caché de 6 horas: Facebook/Instagram con tokens ya guardados, TikTok marcado no disponible por falta de scope de lectura (sin cambiar scopes). Verificado: tsc backend y frontend OK y next build OK; Jest no corrió en el entorno de trabajo por falta de base de test. Pendiente: revisión de Santiago, migraciones 031/032, pruebas en vivo y dominio real del frontend (spotflow.app está aparcado).
