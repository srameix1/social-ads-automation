import fs   from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const KIE_BASE         = 'https://api.kie.ai/api/v1';
const CREATE_ENDPOINT  = `${KIE_BASE}/jobs/createTask`;
const STATUS_ENDPOINT  = `${KIE_BASE}/jobs/recordInfo`;
const UPLOAD_ENDPOINT  = 'https://kieai.redpandaai.co/api/file-stream-upload';

const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS      = 600_000; // 10 minutes

function getApiKey(): string {
  return process.env['KIE_API_KEY'] ?? '';
}

interface UploadResponse {
  data?: { downloadUrl?: string; fileUrl?: string; url?: string };
  fileUrl?: string;
  url?: string;
}

interface CreateTaskResponse {
  data: { taskId: string };
}

interface TaskDetail {
  code: number;
  data: {
    taskId:      string;
    state:       'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?:   string | number | null;
    failMsg?:    string | null;
  };
}

// ── File Upload ────────────────────────────────────────────────────────────

export async function uploadImageToKie(localPath: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY not configured');

  const fileBuffer = fs.readFileSync(localPath);
  const ext        = path.extname(localPath).toLowerCase();
  const mimeType   = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const filename   = path.basename(localPath);

  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
  form.append('uploadPath', 'images/sanads');

  logger.info(`[KIE] Uploading image: ${filename} (${Math.round(fileBuffer.length / 1024)} KB)`);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE file upload HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as UploadResponse;
  const url  = data?.data?.downloadUrl ?? data?.data?.fileUrl ?? data?.data?.url ?? data?.fileUrl ?? data?.url;
  if (!url) throw new Error(`KIE file upload: no URL in response: ${JSON.stringify(data).slice(0, 200)}`);

  logger.info(`[KIE] Image uploaded → ${url}`);
  return url;
}

async function pollTask(taskId: string, apiKey: string, maxWait = MAX_WAIT_MS): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await sleep(POLL_INTERVAL_MS);

    const pollUrl = `${STATUS_ENDPOINT}?taskId=${encodeURIComponent(taskId)}`;
    console.log('[KIE DEBUG] Polling URL:', pollUrl);
    const res = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`KIE task poll HTTP ${res.status}`);

    const detail = await res.json() as TaskDetail;
    const task   = detail.data;

    if (task.state === 'success') {
      if (!task.resultJson) throw new Error('KIE task succeeded but returned no resultJson');

      let parsed: { resultUrls?: string[] };
      try {
        parsed = JSON.parse(task.resultJson);
      } catch {
        throw new Error(`KIE task succeeded but resultJson is malformed: ${task.resultJson.slice(0, 200)}`);
      }

      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error(`KIE task succeeded but resultUrls is empty: ${task.resultJson.slice(0, 200)}`);
      return url;
    }

    if (task.state === 'fail') {
      throw new Error(`KIE task failed: ${task.failMsg ?? 'unknown error'}`);
    }

    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    logger.debug(`[KIE] Polling task ${taskId} (${task.state ?? 'unknown'})… ${elapsedSec}s elapsed`);
  }

  throw new Error(`KIE task timed out after ${maxWait / 1000}s`);
}

async function downloadAndSave(
  videoUrl:  string,
  outputDir: string,
  filename:  string,
): Promise<string> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`KIE video download failed: HTTP ${res.status}`);

  const buf      = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(outputDir, filename);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, buf);
  logger.info(`[KIE] Video saved: ${filePath} (${Math.round(buf.length / 1024)} KB)`);
  return path.resolve(filePath);
}

// ── Grok text-to-video ─────────────────────────────────────────────────────

export async function generateGrokVideo(
  prompt:    string,
  outputDir: string,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY not configured');

  logger.info('[KIE] Generating Grok text-to-video…');

  const res = await fetch(CREATE_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-imagine/text-to-video',
      input: {
        prompt,
        aspect_ratio: '9:16',
        mode:         'normal',
        duration:     6,
        resolution:   '720p',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE Grok text-to-video HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data   = await res.json() as CreateTaskResponse;
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('KIE Grok text-to-video returned no taskId');

  logger.info(`[KIE] Grok task started: ${taskId}`);
  const videoUrl = await pollTask(taskId, apiKey);
  return downloadAndSave(videoUrl, outputDir, `grok_${Date.now()}.mp4`);
}

// ── Hailuo 2.3 image-to-video ─────────────────────────────────────────────

export async function generateHailuoVideo(
  prompt:         string,
  localImagePath: string,
  outputDir:      string,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY not configured');

  logger.info('[KIE] Generating Hailuo 2.3 image-to-video…');

  const imageUrl = await uploadImageToKie(localImagePath);

  const res = await fetch(CREATE_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'hailuo/2-3-image-to-video-standard',
      input: {
        image_url: imageUrl,
        prompt,
        duration:   '10',
        resolution: '768P',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE Hailuo 2.3 HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data   = await res.json() as CreateTaskResponse;
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('KIE Hailuo 2.3 returned no taskId');

  logger.info(`[KIE] Hailuo 2.3 task started: ${taskId}`);
  const videoUrl = await pollTask(taskId, apiKey, 600_000);
  return downloadAndSave(videoUrl, outputDir, `hailuo_${Date.now()}.mp4`);
}

// ── Grok image-to-video ────────────────────────────────────────────────────

export async function generateGrokVideoFromImage(
  prompt:    string,
  imageUrl:  string,
  outputDir: string,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY not configured');

  logger.info('[KIE] Generating Grok image-to-video…');

  const res = await fetch(CREATE_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-imagine/image-to-video',
      input: {
        image_urls:   [imageUrl],
        prompt,
        aspect_ratio: '9:16',
        mode:         'normal',
        duration:     6,
        resolution:   '720p',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE Grok image-to-video HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data   = await res.json() as CreateTaskResponse;
  const taskId = data.data?.taskId;
  if (!taskId) throw new Error('KIE Grok image-to-video returned no taskId');

  logger.info(`[KIE] Grok image-to-video task started: ${taskId}`);
  const videoUrl = await pollTask(taskId, apiKey);
  return downloadAndSave(videoUrl, outputDir, `grok_${Date.now()}.mp4`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
