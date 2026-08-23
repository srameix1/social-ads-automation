# Estado actual — SpotFlow / social-ads-automation

Actualizado: 2026-08-23.

## Contexto operativo

- `AGENTS.md` indica consultar primero este estado y usar `MEMORY.md` como memoria histórica acumulativa; las referencias antiguas a `PROJECT_MEMORY.md` fueron corregidas.
- Frontend: Next.js 14, React 18, TypeScript y Tailwind CSS.
- Backend: Node.js, Express y TypeScript; producción usa una imagen Node 22 Alpine.
- Datos y trabajos: PostgreSQL, `pg` y `pg-boss`.

## Producción e infraestructura

- PostgreSQL de producción es 17.11 en el servicio EasyPanel `spotflow-db`; la base es `social_ads_db` y el usuario `social_ads_user`.
- La configuración local usa PostgreSQL 15, pero no representa la versión de producción.
- EasyPanel está accesible por HTTPS en `https://panel.spotflow.pro`; el DNS del subdominio apunta al VPS.
- El panel administra todos los proyectos del VPS, no solo SpotFlow.
- El token de Deployment Trigger del backend fue rotado; su valor no está documentado.

## Backups y restauración

- `social_ads_db` tiene backups automáticos en Local Disk y Google Drive mediante `spotflow-google-drive`.
- Backup local verificado: `spotflow/spotflow-db/2026-08-23T00:52:05.550Z.sql.gz`.
- Backup externo verificado directamente en Google Drive: `spotflow/spotflow-db/2026-08-23T02:46:57.947Z.sql.gz`.
- Cada respaldo ocupa aproximadamente 13.9 kB.
- Se restauró una copia en una base PostgreSQL 17 temporal e independiente mediante `spotflow-db-restore-test`; la verificación final se hizo con `psql` y no alteró producción.
- La restauración contenía 11 tablas: `users=2`, `client_profiles=2` y 0 registros en `campaigns`, `client_credentials`, `posts`, `publications`, `strategies` y `media_assets`.
- El servicio temporal de restauración fue eliminado.

## bcrypt, pruebas y despliegue

- El backend usa bcrypt 6.0.0 y conserva `@types/bcrypt`; se eliminó la cadena vulnerable `bcrypt → @mapbox/node-pre-gyp → tar`.
- `npm audit` terminó con 0 vulnerabilidades críticas, altas, moderadas o bajas.
- El build fue exitoso; aprobaron 35 pruebas de autenticación y 41 pruebas en la suite completa.
- Existen pruebas de compatibilidad con hashes de bcrypt 5 y de almacenamiento seguro durante el registro.
- La imagen se comprobó con Node 22 Alpine y bcrypt 6.
- El backend fue desplegado correctamente en EasyPanel y se verificó en producción el login de una cuenta existente.
- La imagen Alpine no incluye `/bin/bash`; esto no representa una falla del servicio.

## Git

- `main` está sincronizada con `origin/main` en el commit `3a91e51f1b504940f4fc302fe1f41be2f1c2645e` (`security: verify backups and upgrade bcrypt`).
- El commit contiene la coordinación documental, la actualización de bcrypt y sus dos pruebas nuevas.
- Configuraciones privadas, diagnósticos y artefactos multimedia locales permanecieron fuera del commit.

## Pendientes prioritarios

- Resolver durante 2026 la advertencia de rclone sobre el `client_id` compartido de Google Drive, evaluando una actualización de EasyPanel o un proveedor alternativo.
- Confirmar horarios, zona horaria y retención efectiva de ambos backups.
- Custodiar `ENCRYPTION_KEY` fuera del VPS y revisar el respaldo de `UPLOADS_DIR` y archivos multimedia.
- Confirmar si EasyPanel todavía sirve por IP y evaluar desactivarlo tras validar HTTPS estable.
- Configurar 2FA en EasyPanel.
- Revisar si alguna integración o webhook usaba el Deployment Trigger anterior.
- Investigar los errores históricos de firma de webhooks de Stripe sin asumir que siguen activos.
- Ejecutar una auditoría de seguridad y continuar la fase MEDIUM: headers de seguridad, recuperación/restablecimiento de contraseña, paginación y ampliación de pruebas.
- Diseñar posteriormente métricas y análisis; antes del lanzamiento, repetir la rotación general de tokens y credenciales según el plan del propietario.

## Próximo paso recomendado

Comenzar con una auditoría rápida de seguridad o con headers de seguridad, priorizando también 2FA en EasyPanel y la continuidad futura de los backups externos.
