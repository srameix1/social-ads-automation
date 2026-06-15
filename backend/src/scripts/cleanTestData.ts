import { pool } from '../config/database';

const TABLES = [
  'publications',
  'posts',
  'media_assets',
  'visual_variations',
  'strategies',
  'campaigns',
] as const;

async function main() {
  const client = await pool.connect();
  try {
    console.log('Limpiando datos de prueba...\n');

    for (const table of TABLES) {
      const res = await client.query(`DELETE FROM ${table}`);
      console.log(`  ${table.padEnd(20)} ${res.rowCount} registros borrados`);
    }

    console.log('\nListo.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
