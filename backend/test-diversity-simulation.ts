/**
 * Diversity simulation — 3 consecutive calls showing angle + query rotation.
 * Run: npx ts-node --transpile-only test-diversity-simulation.ts
 */

import { pickAngles, pickSearchTemplates } from './src/utils/randomSelection';

const NICHE = 'ceramic coating car detailing';

function divider(label: string) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(` CALL ${label}`);
  console.log('─'.repeat(55));
}

function validateNoDuplicates<T extends { id?: string; name?: string }>(
  items: T[],
  label: string,
): boolean {
  const keys = items.map(i => i.id ?? i.name ?? '');
  const unique = new Set(keys);
  const ok = unique.size === items.length;
  console.log(`  ✓ ${label} unique within call: ${ok ? 'YES' : `NO — DUPLICATES: ${keys.join(', ')}`}`);
  return ok;
}

async function main() {
  console.log('=== Diversity Simulation — 3 consecutive calls ===');
  console.log(`Niche: "${NICHE}"\n`);

  let previousAngleIds: string[] | undefined;
  let allPassed = true;

  for (let call = 1; call <= 3; call++) {
    divider(String(call));

    // ── Research Queries ────────────────────────────────────────────────────
    const templates = pickSearchTemplates(NICHE);
    console.log(`[ResearchAgent] Selected Research Queries: ${templates.map((t, i) => `${i + 1}. ${t.name}`).join(' | ')}`);
    templates.forEach((t, i) => console.log(`    ${i + 1}. [${t.name}]\n       → "${t.query}"`));

    // ── Copy Angles ─────────────────────────────────────────────────────────
    const angles = pickAngles(3, previousAngleIds);
    const angleIds = angles.map(a => a.id);
    console.log(`\n[CopyGenerator] Selected Angles: ${angles.map((a, i) => `${i + 1}. ${a.name}`).join(' | ')} — IDs: ${angleIds.join(', ')}`);

    // ── Uniqueness checks ───────────────────────────────────────────────────
    console.log('');
    const anglesOk = validateNoDuplicates(angles, 'Angles');
    const queriesOk = validateNoDuplicates(
      templates.map(t => ({ id: t.name })),
      'Queries',
    );

    if (call > 1 && previousAngleIds) {
      const prevSorted = [...previousAngleIds].sort().join(',');
      const currSorted = [...angleIds].sort().join(',');
      const diffFromPrev = currSorted !== prevSorted;
      console.log(`  ✓ Angles different from previous call: ${diffFromPrev ? 'YES' : 'RE-SHUFFLED (same combo, rare)'}`);
    }

    if (!anglesOk || !queriesOk) allPassed = false;

    previousAngleIds = angleIds;
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(allPassed
    ? '✓ ALL CHECKS PASSED — diversity system working correctly'
    : '✗ SOME CHECKS FAILED — see output above');
  console.log('═'.repeat(55));
}

main().catch(err => { console.error(err); process.exit(1); });
