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
