import { Pool, PoolClient } from 'pg';
import { env } from './env';

const TEST_DB_NAME_PATTERN = /_test(_|$)/i;

function dbNameFromConnectionString(connectionString: string): string {
  try {
    return new URL(connectionString).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

/**
 * Salvaguarda anti "test corrió contra la base equivocada": si estamos en
 * NODE_ENV=test, el nombre de la base resuelta (venga de TEST_DATABASE_URL
 * o de DB_NAME) tiene que contener "_test" explícitamente. Cualquier otra
 * cosa aborta el arranque en vez de conectar.
 */
function resolvePoolConfig() {
  if (env.NODE_ENV === 'test') {
    const connectionString = env.TEST_DATABASE_URL || undefined;
    const resolvedName = connectionString
      ? dbNameFromConnectionString(connectionString)
      : env.DB.name;

    if (!TEST_DB_NAME_PATTERN.test(resolvedName)) {
      throw new Error(
        `[DB] Bloqueado: NODE_ENV=test pero la base resuelta ("${resolvedName || '(vacío)'}") ` +
          `no contiene "_test". Configurá TEST_DATABASE_URL (o DB_NAME) apuntando a una base ` +
          `de test explícita — nunca se conecta "a lo que sea" en modo test.`,
      );
    }

    return connectionString
      ? {
          connectionString,
          max:                     5,
          idleTimeoutMillis:       30000,
          connectionTimeoutMillis: 5000,
        }
      : {
          host:                    env.DB.host,
          port:                    env.DB.port,
          database:                env.DB.name,
          user:                    env.DB.user,
          password:                env.DB.password,
          max:                     5,
          idleTimeoutMillis:       30000,
          connectionTimeoutMillis: 2000,
        };
  }

  return env.DATABASE_URL
    ? {
        connectionString:        env.DATABASE_URL,
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
}

export const pool = new Pool(resolvePoolConfig());

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
