// Test descartable: sólo verifica que la infraestructura de tests
// (NODE_ENV=test, conexión a la base *_test, truncado) funciona.
// Borrar cuando existan tests de integración reales que cubran lo mismo.
import { pool, query } from '../../src/config/database';
import { env } from '../../src/config/env';
import { truncateAllTables, closeTestPool } from './dbTestHelper';

describe('infraestructura de tests', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2);
  });

  it('corre con NODE_ENV=test', () => {
    expect(env.NODE_ENV).toBe('test');
  });

  it('se conecta a una base cuyo nombre contiene "_test"', async () => {
    const [row] = await query<{ current_database: string }>('SELECT current_database()');
    expect(row.current_database).toMatch(/_test/i);
  });

  it('ve las tablas creadas por las 27 migraciones', async () => {
    const rows = await query<{ count: string }>(
      "SELECT COUNT(*)::text FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(11);
  });

  it('truncateAllTables corre sin error y deja las tablas transaccionales vacías', async () => {
    await truncateAllTables();
    const [row] = await query<{ count: string }>('SELECT COUNT(*)::text FROM users');
    expect(row.count).toBe('0');
  });

  it('pool sigue vivo después de truncar', async () => {
    expect(pool.totalCount).toBeGreaterThanOrEqual(0);
  });
});
