import { pool, query } from '../../src/config/database';
import { env } from '../../src/config/env';

// Tablas transaccionales que se ensucian con datos de cada test.
// Excluidas a propósito:
//   - schema_migrations: registro de qué migraciones corrieron, no dato de test.
//   - plan_limits: catálogo de referencia sembrado por la migración 012, no
//     estado por-tenant — truncarla rompería cualquier test que dependa de
//     los límites de plan (basic/professional/premium).
const TRANSACTIONAL_TABLES = [
  'publications',
  'posts',
  'visual_variations',
  'media_assets',
  'strategies',
  'campaigns',
  'client_credentials',
  'client_profiles',
  'users',
];

function assertRunningAgainstTestDb(): void {
  if (env.NODE_ENV !== 'test') {
    throw new Error(
      `[test-db] Rechazado: NODE_ENV="${env.NODE_ENV}", se esperaba "test". ` +
        'El helper de truncado sólo puede correr en modo test — abortando para no borrar datos reales.',
    );
  }
}

/**
 * Vacía todas las tablas transaccionales entre tests para que cada uno
 * arranque de un estado limpio y reproducible. Pensado para llamarse en
 * beforeEach/afterEach de cada suite de integración.
 *
 * Segunda capa de seguridad además de la de src/config/database.ts (que ya
 * bloquea la conexión si NODE_ENV=test y el nombre de la base no contiene
 * "_test"): acá se vuelve a chequear NODE_ENV antes de truncar.
 */
export async function truncateAllTables(): Promise<void> {
  assertRunningAgainstTestDb();
  await query(`TRUNCATE TABLE ${TRANSACTIONAL_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

/** Cierra el pool de conexiones — llamar una vez en afterAll de cada suite. */
export async function closeTestPool(): Promise<void> {
  await pool.end();
}
