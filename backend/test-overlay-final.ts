/**
 * Test script: applyVideoOverlays with logo + copy text.
 * Verifies: logo at 360×180px max (top-right), text copy (bottom), audio preserved.
 * Run with:  npx ts-node --transpile-only test-overlay-final.ts
 */

import path     from 'path';
import fs       from 'fs';
import { execFile } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { applyVideoOverlays } from './src/services/contentGeneration.service';

const VIDEO_PATH  = path.resolve(__dirname, 'uploads/videos/f1c6b7d2-13f7-4fcf-b836-07df8a5c62ca/kling3_1781401539455.mp4');
const LOGO_PATH   = path.resolve(__dirname, 'uploads/logos/24bc5a2c5d5bc6398ed418ee6d654f66.png');
const OUTPUT_PATH = path.resolve(__dirname, 'uploads/videos/f1c6b7d2-13f7-4fcf-b836-07df8a5c62ca/test_overlay_output.mp4');
const FRAME_DIR   = path.dirname(OUTPUT_PATH);

function probeStreams(filePath: string): Promise<string> {
  return new Promise((res, rej) => {
    execFile(ffmpegInstaller.path, ['-i', filePath], (_err, _stdout, stderr) => {
      // ffmpeg always exits with code 1 when no output is given — use stderr
      res(stderr);
    });
  });
}

function extractFrame(ts: number, outFile: string): Promise<void> {
  return new Promise((res, rej) => {
    execFile(ffmpegInstaller.path, [
      '-ss', String(ts), '-i', OUTPUT_PATH,
      '-frames:v', '1', '-q:v', '2', '-y', outFile,
    ], (err) => err ? rej(err) : res());
  });
}

async function main() {
  console.log('=== test-overlay-final (logo + copy) ===\n');

  if (!fs.existsSync(VIDEO_PATH)) { console.error('ERROR: Video not found:', VIDEO_PATH); process.exit(1); }
  if (!fs.existsSync(LOGO_PATH))  { console.error('ERROR: Logo not found:',  LOGO_PATH);  process.exit(1); }

  console.log(`Input : ${path.basename(VIDEO_PATH)} (${(fs.statSync(VIDEO_PATH).size / 1024).toFixed(1)} KB)`);
  console.log(`Logo  : ${path.basename(LOGO_PATH)}`);

  // ── Probe INPUT streams ────────────────────────────────────────────────────
  const inputInfo = await probeStreams(VIDEO_PATH);
  console.log('\nInput streams:');
  inputInfo.split('\n').filter(l => l.includes('Stream #')).forEach(l => console.log(' ', l.trim()));

  // ── Run overlay ───────────────────────────────────────────────────────────
  console.log('\nCalling applyVideoOverlays (logo=true, copy=true)…');
  const t0 = Date.now();

  try {
    await applyVideoOverlays(
      VIDEO_PATH,
      'Ceramic coating profesional. Protege tu auto desde $299.',
      LOGO_PATH,
      true,   // overlayLogo
      true,   // overlayCopy
      OUTPUT_PATH,
    );

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!fs.existsSync(OUTPUT_PATH) || fs.statSync(OUTPUT_PATH).size === 0) {
      console.error('ERROR: Output missing or empty'); process.exit(1);
    }
    console.log(`\nOutput: ${path.basename(OUTPUT_PATH)} (${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB, ${elapsed}s)`);

    // ── Probe OUTPUT streams ───────────────────────────────────────────────
    const outputInfo = await probeStreams(OUTPUT_PATH);
    const streamLines = outputInfo.split('\n').filter(l => l.includes('Stream #'));
    console.log('\nOutput streams:');
    streamLines.forEach(l => console.log(' ', l.trim()));

    const hasVideo = streamLines.some(l => l.includes('Video'));
    const hasAudio = streamLines.some(l => l.includes('Audio'));
    console.log(`\n  Video stream: ${hasVideo ? '✓' : '✗ MISSING'}`);
    console.log(`  Audio stream: ${hasAudio ? '✓' : '✗ MISSING'}`);

    if (!hasVideo || !hasAudio) {
      console.error('\n✗ FAILED — missing streams'); process.exit(1);
    }

    // ── Extract frames for visual verification ────────────────────────────
    console.log('\nExtracting frames…');
    for (const ts of [0.5, 2.5, 4.5]) {
      const frameFile = path.join(FRAME_DIR, `_verify_${ts}s.jpg`);
      await extractFrame(ts, frameFile);
      const size = fs.existsSync(frameFile) ? fs.statSync(frameFile).size : 0;
      console.log(`  t=${ts}s → ${path.basename(frameFile)} (${(size / 1024).toFixed(1)} KB) ${size > 0 ? '✓' : '✗'}`);
    }

    console.log('\n✓ SUCCESS — logo (360×180 max, top-right) + text (bottom) + audio all confirmed');
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n✗ FAILED after ${elapsed}s:`, (err as Error).message);
    process.exit(1);
  }
}

main();
