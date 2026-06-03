import { Pool, PoolClient } from 'pg';
import { env } from './env';

const poolConfig = env.DATABASE_URL
  ? {
      connectionString:        env.DATABASE_URL,
      ssl:                     { rejectUnauthorized: false },
      max:                     20,
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host:                    env.DB.host,
      port:                    env.DB.port,
      database:                env.DB.name,
      user:                    env.DB.user,
      password:                env.DB.password,
      max:                     20,
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool:', err.message);
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
