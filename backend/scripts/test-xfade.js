// Standalone diagnostic script — tests ONLY the concatWithXfade ffmpeg logic
// (fixed to use -filter_complex_script) against clips already on disk, with
// no AI generation involved. Not called from any route/service.
//
// Run inside the container:
//   node scripts/test-xfade.js [clip1] [clip2] [clip3]
// or edit CLIP_PATHS below and run with no arguments.

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// ── Edit these if not passing clip paths as CLI args ───────────────────────
const CLIP_PATHS = [
  '/app/uploads/videos/clip1.mp4',
  '/app/uploads/videos/clip2.mp4',
  '/app/uploads/videos/clip3.mp4',
];
const AUDIO_PATH = null; // set to a path to also test the audio mux step
const TMP_DIR = '/app/uploads';
const OUTPUT_PATH = '/app/uploads/test-xfade-output.mp4';
const CLIP_DURATION = 7;
const TRANSITION_DURATION = 0.5;
const TRANSITIONS = ['fade', 'slideup'];
// ────────────────────────────────────────────────────────────────────────────

const clips = process.argv.length >= 5 ? process.argv.slice(2, 5) : CLIP_PATHS;

// Same logic as concatWithXfade in src/services/contentGeneration.service.ts
async function concatWithXfade(clips, audioPath, output, tmpDir, clipDuration, transitionDuration, transitions) {
  const silentOut = path.join(tmpDir, `_tmp_xfade_silent_${Date.now()}.mp4`);

  if (clips.length === 1) {
    await new Promise((resolve, reject) => {
      ffmpeg().input(clips[0]).videoCodec('copy').noAudio().output(silentOut)
        .on('end', () => resolve())
        .on('error', (e) => reject(new Error(`XFade copy: ${e.message}`))).run();
    });
  } else {
    const filterParts = [];
    let prevLabel = '[0:v]';

    for (let i = 0; i < clips.length - 1; i++) {
      const transition = transitions[i] ?? 'fade';
      const offset = (i + 1) * clipDuration - (i + 1) * transitionDuration;
      const isLast = i === clips.length - 2;
      const outLabel = isLast ? '[vout]' : `[v${i}]`;
      filterParts.push(
        `${prevLabel}[${i + 1}:v]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset.toFixed(3)}${outLabel}`,
      );
      prevLabel = outLabel;
    }

    const filterScriptPath = path.join(tmpDir, `_tmp_xfade_filter_${Date.now()}.txt`);
    fs.writeFileSync(filterScriptPath, filterParts.join(';'));

    console.log('[XFADE TEST] filterParts:', JSON.stringify(filterParts));
    console.log('[XFADE TEST] joined filter:', filterParts.join(';'));
    console.log('[XFADE TEST] clips array:', JSON.stringify(clips));
    console.log('[XFADE TEST] filter script written to:', filterScriptPath);

    const cleanupFilterScript = () => {
      try { if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath); } catch (_) { /* ignore */ }
    };

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      clips.forEach((c) => cmd.input(c));
      cmd
        .outputOptions([
          '-filter_complex_script', filterScriptPath,
          '-map', '[vout]',
          '-preset fast', '-crf 22', '-pix_fmt yuv420p',
        ])
        .videoCodec('libx264')
        .noAudio()
        .output(silentOut)
        .on('start', (c) => console.log(`[XFADE TEST] FULL CMD: ${c}`))
        .on('end', () => { cleanupFilterScript(); resolve(); })
        .on('error', (e) => { cleanupFilterScript(); reject(new Error(`XFade concat: ${e.message}`)); }).run();
    });
  }

  const totalDuration = clips.length * clipDuration - (clips.length - 1) * transitionDuration;
  if (audioPath && fs.existsSync(audioPath)) {
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(silentOut)
        .input(audioPath)
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate(128)
        .audioFilter(`afade=t=out:st=${(totalDuration - 1.5).toFixed(2)}:d=1.5`)
        .outputOptions(['-shortest'])
        .output(output)
        .on('end', () => resolve())
        .on('error', (e) => reject(new Error(`XFade mux: ${e.message}`))).run();
    });
    try { fs.unlinkSync(silentOut); } catch (_) { /* ignore */ }
  } else {
    fs.renameSync(silentOut, output);
  }
}

(async () => {
  console.log('[XFADE TEST] Starting standalone xfade test');
  console.log('[XFADE TEST] Clips:', clips);
  console.log('[XFADE TEST] Output:', OUTPUT_PATH);

  for (const c of clips) {
    if (!fs.existsSync(c)) {
      console.error(`[XFADE TEST] FALLO: no existe el clip de entrada: ${c}`);
      process.exit(1);
    }
  }

  try {
    await concatWithXfade(clips, AUDIO_PATH, OUTPUT_PATH, TMP_DIR, CLIP_DURATION, TRANSITION_DURATION, TRANSITIONS);
    console.log(`[XFADE TEST] EXITO: video generado en ${OUTPUT_PATH}`);
    process.exit(0);
  } catch (err) {
    console.error(`[XFADE TEST] FALLO: ${err.message}`);
    process.exit(1);
  }
})();
