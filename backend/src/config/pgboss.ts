import { env } from './env';
import { logger } from '../utils/logger';

// pg-boss v12+ se distribuye como ESM puro ("type": "module", sin export default —
// expone la clase con el nombre "PgBoss"). El proyecto compila a CommonJS
// (tsconfig.json: module=commonjs), así que un `import` estático fallaría.
// El `import()` dinámico de abajo lo compila tsc a un `require()`, que en Node ≥22.12
// puede cargar módulos ESM de forma nativa — verificado en este mismo entorno (Node 24).
type PgBossInstance = InstanceType<typeof import('pg-boss').PgBoss>;

let bossPromise: Promise<PgBossInstance> | null = null;

function buildConnectionString(): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const { host, port, name, user, password } = env.DB;
  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

async function initBoss(): Promise<PgBossInstance> {
  const { PgBoss } = await import('pg-boss');
  // retryLimit/retryBackoff son opciones de queue (createQueue), no del constructor.
  const boss = new PgBoss({
    connectionString: buildConnectionString(),
  });

  boss.on('error', (err: Error) => {
    logger.error('[pg-boss] Error interno:', err.message);
  });

  await boss.start();
  return boss;
}

export function getBoss(): Promise<PgBossInstance> {
  if (!bossPromise) bossPromise = initBoss();
  return bossPromise;
}
