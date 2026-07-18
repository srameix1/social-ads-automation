import cron from 'node-cron';
import app from './app';
import { env } from './config/env';
import { pool } from './config/database';
import { logger } from './utils/logger';
import { cleanupOldFiles } from './jobs/cleanupVideos.job';
import { runCourtesyExpiryCheck } from './jobs/courtesyExpiry.job';
import { getBoss } from './config/pgboss';
import { registerPublishPostWorker } from './jobs/publishPost.job';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

async function start() {
  // Verificar conexión a la base de datos (no bloquear el inicio si falla)
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('✓ Conexión a PostgreSQL establecida');
  } catch (err) {
    logger.warn('⚠ PostgreSQL no disponible — el servidor inicia de todos modos', { error: (err as Error).message });
    logger.warn('  Intentando conectar a:', {
      host: env.DB.host,
      port: env.DB.port,
      database: env.DB.name,
      user: env.DB.user,
      DATABASE_URL: env.DATABASE_URL ? 'SET' : 'NOT SET',
    });
    logger.warn('  Verifica que el contenedor de Postgres esté corriendo en EasyPanel y reinicia el servidor');
  }

  // Run cleanup on startup, then every 24h
  cleanupOldFiles().catch(err => logger.warn('[Cleanup] Error en startup:', err));
  setInterval(() => {
    cleanupOldFiles().catch(err => logger.warn('[Cleanup] Error en cleanup periódico:', err));
  }, CLEANUP_INTERVAL_MS);
  logger.info('[Cleanup] Scheduled daily cleanup every 24h');

  // Courtesy: revoca cortesías vencidas y alerta las que vencen en 3 días — corre al iniciar y luego diario a las 09:00.
  runCourtesyExpiryCheck().catch(err => logger.warn('[Courtesy] Error en chequeo inicial:', err));
  cron.schedule('0 9 * * *', () => {
    runCourtesyExpiryCheck().catch(err => logger.warn('[Courtesy] Error en chequeo diario:', err));
  });
  logger.info('[Courtesy] Scheduled daily expiry check at 09:00');

  // Cola de publicación (pg-boss): confirmPost encola en 'publish-post' y este
  // worker la procesa. Sobrevive reinicios porque el job vive en Postgres, no en memoria.
  try {
    const boss = await getBoss();
    await registerPublishPostWorker(boss);
    logger.info('[PublishQueue] Worker registrado (publish-post, tiktok-check-status)');
  } catch (err) {
    logger.error('[PublishQueue] No se pudo iniciar pg-boss — la publicación automática quedará sin procesar:', (err as Error).message);
  }

  app.listen(env.PORT, () => {
    logger.info(`✓ Servidor corriendo en http://localhost:${env.PORT}`);
    logger.info(`  Entorno: ${env.NODE_ENV}`);
    logger.info(`  CORS habilitado para: ${env.FRONTEND_URL}`);
  });
}

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});

start();
