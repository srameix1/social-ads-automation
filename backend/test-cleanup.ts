/**
 * Validation test for cleanupOldFiles()
 * Run with: npx ts-node test-cleanup.ts
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { cleanupOldFiles } from './src/jobs/cleanupVideos.job';

const EIGHT_DAYS_MS     = 8 * 24 * 60 * 60 * 1000;
const SIX_DAYS_MS       = 6 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS     = 7 * 24 * 60 * 60 * 1000;
// 1 minute under the threshold — clearly in "keep" zone regardless of execution lag
const NEAR_BOUNDARY_MS = SEVEN_DAYS_MS - 60_000;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function touch(filePath: string, content = 'x'): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function setMtime(filePath: string, ageMs: number): void {
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(filePath, t, t);
}

async function runTests(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sanads-cleanup-test-'));
  console.log(`\n[Test] Using temp dir: ${root}\n`);

  try {
    // ── Create test fixture files ────────────────────────────────────────────

    // videos/ — old (8d) → should be deleted
    const oldVideo = path.join(root, 'videos', 'old_clip.mp4');
    touch(oldVideo, 'fake-video-data');
    setMtime(oldVideo, EIGHT_DAYS_MS);

    // videos/ — recent (6d) → should NOT be deleted
    const recentVideo = path.join(root, 'videos', 'new_clip.mp4');
    touch(recentVideo, 'fake-video-data');
    setMtime(recentVideo, SIX_DAYS_MS);

    // variations/ — old (8d) → should be deleted
    const oldVariation = path.join(root, 'variations', 'sub', 'var_old.jpg');
    touch(oldVariation, 'fake-img-data');
    setMtime(oldVariation, EIGHT_DAYS_MS);

    // variations/ — recent (6d) → should NOT be deleted
    const recentVariation = path.join(root, 'variations', 'sub', 'var_new.jpg');
    touch(recentVariation, 'fake-img-data');
    setMtime(recentVariation, SIX_DAYS_MS);

    // logos/ — old (8d) → must NOT be deleted (excluded dir)
    const oldLogo = path.join(root, 'logos', 'brand_logo.png');
    touch(oldLogo, 'fake-logo-data');
    setMtime(oldLogo, EIGHT_DAYS_MS);

    // 1 minute under 7 days → must NOT be deleted
    const boundaryVideo = path.join(root, 'videos', 'boundary.mp4');
    touch(boundaryVideo, 'fake');
    setMtime(boundaryVideo, NEAR_BOUNDARY_MS);

    // ── Run cleanup ──────────────────────────────────────────────────────────
    console.log('[Test] Running cleanupOldFiles()...');
    const result = await cleanupOldFiles(root, SEVEN_DAYS_MS);

    // ── Assertions ───────────────────────────────────────────────────────────
    console.log('\n[Test] Assertions:\n');

    assert(!fs.existsSync(oldVideo),      'videos/old_clip.mp4 (8d) was deleted');
    assert(!fs.existsSync(oldVariation),  'variations/sub/var_old.jpg (8d) was deleted');

    assert(fs.existsSync(recentVideo),     'videos/new_clip.mp4 (6d) was kept');
    assert(fs.existsSync(recentVariation), 'variations/sub/var_new.jpg (6d) was kept');
    assert(fs.existsSync(boundaryVideo),   'videos/boundary.mp4 (6d 23h) was kept');

    assert(fs.existsSync(oldLogo),         'logos/brand_logo.png (8d) was NOT touched');

    assert(result.deletedFiles === 2, `deletedFiles === 2 (got ${result.deletedFiles})`);
    assert(result.freedBytes > 0,     `freedBytes > 0 (got ${result.freedBytes})`);

    // Empty subdirectory under variations/sub should be removed after its files are gone
    // (var_new.jpg still there so sub/ stays — verify it still exists)
    assert(fs.existsSync(path.dirname(recentVariation)), 'variations/sub/ kept (still has recent file)');

  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('\n─────────────────────────────────────');
  if (failed === 0) {
    console.log(`\n✅  SUCCESS — ${passed}/${passed + failed} tests passed\n`);
    process.exit(0);
  } else {
    console.error(`\n❌  FAILED — ${failed} test(s) failed\n`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
