/**
 * reset-db.ts — Wipe all campaign/post test data, keep user accounts & config.
 *
 * Deletes (in FK-safe order):
 *   publications → media_assets → visual_variations → strategies → posts → campaigns
 *
 * Keeps:
 *   users, client_profiles, client_credentials, plan_limits
 *
 * Run: npx ts-node --transpile-only reset-db.ts
 */

import './src/config/env';
import { pool } from './src/config/database';

interface CountRow { count: string }

async function count(table: string): Promise<number> {
  const res = await pool.query<CountRow>(`SELECT COUNT(*) FROM ${table}`);
  return parseInt(res.rows[0].count, 10);
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('=== reset-db ===\n');

    // ── 1. Show current counts before delete ──────────────────────────────
    console.log('Conteos ANTES del reset:');
    const tablesBefore = [
      'publications', 'media_assets', 'visual_variations',
      'strategies', 'posts', 'campaigns',
      'client_profiles', 'users',
    ];
    for (const t of tablesBefore) {
      const n = await count(t);
      console.log(`  ${t.padEnd(22)}: ${n}`);
    }

    // ── 2. Confirm prompt (auto-proceed in script) ─────────────────────────
    console.log('\nBorrando datos de prueba...\n');

    // ── 3. Delete in FK-safe order inside a transaction ───────────────────
    await client.query('BEGIN');

    const steps: Array<{ table: string; sql: string }> = [
      { table: 'publications',      sql: 'DELETE FROM publications'      },
      { table: 'media_assets',      sql: 'DELETE FROM media_assets'      },
      { table: 'visual_variations', sql: 'DELETE FROM visual_variations' },
      { table: 'strategies',        sql: 'DELETE FROM strategies'        },
      { table: 'posts',             sql: 'DELETE FROM posts'             },
      { table: 'campaigns',         sql: 'DELETE FROM campaigns'         },
    ];

    for (const { table, sql } of steps) {
      const res = await client.query(sql);
      console.log(`  ✓ ${table.padEnd(22)}: ${res.rowCount} filas borradas`);
    }

    await client.query('COMMIT');
    console.log('\n✓ Transacción confirmada\n');

    // ── 4. Verify all target tables are empty ─────────────────────────────
    console.log('Verificación — conteos DESPUÉS del reset:');
    const tablesAfter = [
      'publications', 'media_assets', 'visual_variations',
      'strategies', 'posts', 'campaigns',
    ];

    let allEmpty = true;
    for (const t of tablesAfter) {
      const n = await count(t);
      const ok = n === 0;
      if (!ok) allEmpty = false;
      console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(22)}: ${n} filas`);
    }

    // ── 5. Confirm preserved tables are untouched ──────────────────────────
    console.log('\nTablas preservadas (NO borradas):');
    const preserved = ['users', 'client_profiles', 'client_credentials', 'plan_limits'];
    for (const t of preserved) {
      const n = await count(t);
      console.log(`  ✓ ${t.padEnd(22)}: ${n} filas (intactas)`);
    }

    // ── 6. Final summary ──────────────────────────────────────────────────
    console.log('\n══════════════════════════════════');
    if (allEmpty) {
      console.log('SUCCESS — base de datos limpia');
    } else {
      console.log('FAILED  — algunas tablas no están vacías (ver arriba)');
    }
    console.log('══════════════════════════════════');

    if (!allEmpty) process.exit(1);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — ROLLBACK aplicado');
    console.error((err as Error).stack ?? err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
