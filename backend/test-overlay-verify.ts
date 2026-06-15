/**
 * Verification script: checks audio streams and extracts frames from mid-video
 * to confirm text is present throughout (not just at the start).
 * Run: npx ts-node --transpile-only test-overlay-verify.ts
 */

import { execFileSync } from 'child_process';
import path from 'path';
import fs   from 'fs';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const FFMPEG = ffmpegInstaller.path;

const INPUT  = path.resolve(__dirname, 'uploads/videos/7554092e-7615-48db-ac76-414874d4997f/kling3_1781368317297.mp4');
const OUTPUT = path.resolve(__dirname, 'uploads/videos/test_overlay_final.mp4');

function run(args: string[]): string {
  try {
    return execFileSync(FFMPEG, args, { encoding: 'utf8', stderr: 'pipe' });
  } catch (e: any) {
    // ffmpeg writes to stderr even on success
    return (e.stderr ?? e.stdout ?? e.message ?? '') as string;
  }
}

function probeStreams(filePath: string): string {
  // ffmpeg -i file will print stream info to stderr then exit with code 1
  try {
    execFileSync(FFMPEG, ['-i', filePath], { encoding: 'utf8' });
  } catch (e: any) {
    return (e.stderr ?? '') as string;
  }
  return '';
}

function extractFrame(filePath: string, timestampSec: number, outJpeg: string): boolean {
  try {
    execFileSync(FFMPEG, [
      '-ss', String(timestampSec),
      '-i', filePath,
      '-frames:v', '1',
      '-q:v', '2',
      '-y',
      outJpeg,
    ], { encoding: 'utf8' });
    return fs.existsSync(outJpeg) && fs.statSync(outJpeg).size > 0;
  } catch (e: any) {
    // ffmpeg exits 0 on success but let's also check the file
    return fs.existsSync(outJpeg) && fs.statSync(outJpeg).size > 0;
  }
}

function getDurationSec(filePath: string): number | null {
  const info = probeStreams(filePath);
  const m = info.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
}

async function main() {
  console.log('=== test-overlay-verify ===\n');

  if (!fs.existsSync(OUTPUT)) {
    console.error('Output file missing — run test-overlay-final.ts first.');
    process.exit(1);
  }

  // ── 1. Stream info ────────────────────────────────────────────────────────
  console.log('─── INPUT streams ───');
  const inputInfo = probeStreams(INPUT);
  const inputAudio = inputInfo.match(/Stream.*Audio.*/g) ?? [];
  const inputVideo = inputInfo.match(/Stream.*Video.*/g) ?? [];
  console.log('Video:', inputVideo[0]?.trim() ?? 'NONE');
  console.log('Audio:', inputAudio[0]?.trim() ?? 'NONE');

  console.log('\n─── OUTPUT streams ───');
  const outputInfo = probeStreams(OUTPUT);
  const outputAudio = outputInfo.match(/Stream.*Audio.*/g) ?? [];
  const outputVideo = outputInfo.match(/Stream.*Video.*/g) ?? [];
  console.log('Video:', outputVideo[0]?.trim() ?? 'NONE');
  console.log('Audio:', outputAudio[0]?.trim() ?? 'NONE');

  const hasAudio = outputAudio.length > 0;
  console.log('\nAudio check:', hasAudio ? '✓ PASS — output has audio' : '✗ FAIL — output has NO audio');

  // ── 2. Duration check ─────────────────────────────────────────────────────
  const inputDur  = getDurationSec(INPUT);
  const outputDur = getDurationSec(OUTPUT);
  console.log(`\nInput duration : ${inputDur?.toFixed(2)}s`);
  console.log(`Output duration: ${outputDur?.toFixed(2)}s`);
  const durOk = outputDur !== null && inputDur !== null && Math.abs(outputDur - inputDur) < 1;
  console.log('Duration check:', durOk ? '✓ PASS — durations match' : `⚠  MISMATCH (delta ${Math.abs((outputDur??0)-(inputDur??0)).toFixed(2)}s)`);

  // ── 3. Extract frames at 10%, 50%, 90% of video duration ─────────────────
  console.log('\n─── Frame extraction (checking text persists throughout) ───');
  const dur = outputDur ?? 10;
  const checkPoints = [0.1, 0.5, 0.9].map(p => Math.round(dur * p * 10) / 10);

  let allFramesOk = true;
  for (const t of checkPoints) {
    const jpegOut = path.resolve(__dirname, `uploads/videos/_verify_frame_${t}s.jpg`);
    if (fs.existsSync(jpegOut)) fs.unlinkSync(jpegOut);
    const ok = extractFrame(OUTPUT, t, jpegOut);
    const size = ok ? fs.statSync(jpegOut).size : 0;
    console.log(`  t=${t}s → ${ok ? `✓ frame extracted (${(size/1024).toFixed(1)} KB)` : '✗ FAILED'} → ${jpegOut}`);
    if (!ok) allFramesOk = false;
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log('\n═══ SUMMARY ═══');
  console.log('1. Audio in output :', hasAudio    ? '✓ YES' : '✗ NO');
  console.log('2. Duration match  :', durOk       ? '✓ YES' : '⚠  CHECK');
  console.log('3. Frames extracted:', allFramesOk ? '✓ YES — open JPEGs to confirm text at each timestamp' : '✗ SOME FAILED');

  if (!hasAudio) {
    console.log('\nAudio debug — ffmpeg output for output file:');
    console.log(outputInfo.split('\n').filter(l => l.includes('Audio') || l.includes('Stream')).join('\n'));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
