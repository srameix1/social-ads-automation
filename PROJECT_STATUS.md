# Estado actual — SpotFlow / social-ads-automation

Actualizado: 2026-08-23.

## Proyecto y stack verificados

- Frontend: Next.js 14, React 18, TypeScript y Tailwind CSS; imagen de producción definida en `frontend/Dockerfile` con salida standalone.
- Backend: Node.js, Express y TypeScript; imagen de producción definida en `backend/Dockerfile`.
- Datos y trabajos: PostgreSQL, `pg` y `pg-boss`; migraciones SQL en `backend/database/migrations/`.

## PostgreSQL e infraestructura

- Producción utiliza PostgreSQL 17.11 en EasyPanel.
- EasyPanel utiliza el dominio seguro `https://panel.spotflow.pro`.
- Existe un registro DNS A para `panel.spotflow.pro` que apunta al VPS.
- El servicio PostgreSQL de producción es `spotflow-db`.
- La base de datos real es `social_ads_db` y su usuario es `social_ads_user`.
- El entorno local usa `docker-compose.yml` con PostgreSQL 15 Alpine, pgAdmin, healthcheck y el volumen Docker nombrado `postgres_data`.
- La aplicación acepta `DATABASE_URL`; si no existe, usa `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.
- En modo test existe una salvaguarda que exige que el nombre de la base contenga `_test` y permite `TEST_DATABASE_URL`.
- Los Dockerfiles construyen frontend y backend por separado. El `docker-compose.yml` local solo define PostgreSQL y pgAdmin; no incluye frontend ni backend.

## Backup y restauración verificados

- EasyPanel tiene configurados dos backups automáticos para `social_ads_db`: Local Disk y Google Drive mediante el proveedor `spotflow-google-drive`.
- El primer backup se generó correctamente en `spotflow/spotflow-db/2026-08-23T00:52:05.550Z.sql.gz`.
- El archivo comprimido ocupa 13.9 kB.
- El backup externo se ejecutó manualmente con éxito y se verificó directamente en Google Drive el archivo `spotflow/spotflow-db/2026-08-23T02:46:57.947Z.sql.gz`, de 13.9 kB.
- La restauración fue comprobada en una base temporal independiente mediante el servicio `spotflow-db-restore-test`.
- Se recuperaron 11 tablas, 2 usuarios y 2 perfiles.
- Actualmente `campaigns`, `client_credentials`, `posts`, `publications`, `strategies` y `media_assets` tienen 0 registros.
- La producción no fue alterada durante la prueba de restauración.
- El servicio temporal `spotflow-db-restore-test` fue eliminado después de la comprobación.
- El repositorio no contiene scripts propios de backup/restauración ni variables de backup; la automatización verificada reside en EasyPanel.

## Tareas programadas de la aplicación

- El backend ejecuta limpieza cada 24 horas y un chequeo diario de cortesías a las 09:00.
- Los trabajos persistentes de publicación se procesan mediante `pg-boss`.
- Estas tareas de aplicación no realizan backups.

## Actualización de bcrypt verificada

- El backend usa `bcrypt` 6.0.0; `@types/bcrypt` se conserva en 5.0.2.
- Se añadió una prueba que confirma que bcrypt 6 verifica un hash generado previamente con bcrypt 5.1.1 y otra que valida que el registro almacena un hash verificable, nunca la contraseña en texto plano.
- `npm audit` del backend terminó con 0 vulnerabilidades; desaparecieron la vulnerabilidad crítica y la alta de la cadena `bcrypt → @mapbox/node-pre-gyp → tar`.
- El build del backend terminó correctamente.
- Las pruebas de autenticación terminaron con 6 suites y 35 tests aprobados.
- La suite completa del backend terminó con 7 suites y 41 tests aprobados.
- La imagen local `spotflow-backend:bcrypt6-test` se construyó correctamente con Node 22 Alpine. Dentro de la imagen se verificaron Node 22.23.2, bcrypt 6.0.0 y una operación real de hash y comparación.
- No se desplegó a producción ni se modificaron hashes existentes en PostgreSQL.

## Pendientes reales

- Confirmar horario, zona horaria y política de retención.
- Conservar de forma segura `ENCRYPTION_KEY`.
- Evaluar el backup de archivos multimedia almacenados fuera de PostgreSQL.
- Resolver la advertencia de rclone sobre el `client_id` compartido de Google Drive, que dejará de funcionar durante 2026.

## Trabajo local preexistente observado

- `frontend/next-env.d.ts` ya estaba modificado.
- Hay scripts diagnósticos, artefactos multimedia, salidas de pruebas y `.claude/settings.local.json` sin seguimiento; no fueron modificados durante esta actualización documental.
