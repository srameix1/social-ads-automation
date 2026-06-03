import app from './app';
import { env } from './config/env';
import { pool } from './config/database';
import { logger } from './utils/logger';

async function start() {
  // Verificar conexión a la base de datos (no bloquear el inicio si falla)
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('✓ Conexión a PostgreSQL establecida');
  } catch (err) {
    logger.warn('⚠ PostgreSQL no disponible — el servidor inicia de todos modos');
    logger.warn('  Reactiva el proyecto en https://supabase.com/dashboard y reinicia el servidor');
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
