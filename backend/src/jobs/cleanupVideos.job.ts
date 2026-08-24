import fs from 'fs';
import path from 'path';
import { getUploadsDir } from '../utils/storage';
import { logger } from '../utils/logger';
import { query } from '../config/database';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Directories to scan (relative to uploads root). logos/ is intentionally excluded.
const CLEANUP_DIRS = ['videos', 'variations'];

interface CleanupResult {
  deletedFiles: number;
  freedBytes:   number;
  expiredRows:  number;
}

export async function cleanupOldFiles(
  uploadsRoot = getUploadsDir(),
  maxAgeMs    = MAX_AGE_MS,
): Promise<CleanupResult> {
  const now    = Date.now();
  let deletedFiles = 0;
  let freedBytes   = 0;
  let expiredRows  = 0;

  for (const dir of CLEANUP_DIRS) {
    const targetDir = path.join(uploadsRoot, dir);
    if (!fs.existsSync(targetDir)) continue;

    const result = await scanAndDelete(targetDir, uploadsRoot, now, maxAgeMs);
    deletedFiles += result.deletedFiles;
    freedBytes   += result.freedBytes;
    expiredRows  += result.expiredRows;

    removeEmptyDirs(targetDir);
  }

  const freedMB = (freedBytes / 1024 / 1024).toFixed(2);
  logger.info(`[Cleanup] Eliminados ${deletedFiles} archivos — ${freedMB} MB liberados — ${expiredRows} filas marcadas expiradas en visual_variations`);

  return { deletedFiles, freedBytes, expiredRows };
}

async function scanAndDelete(dir: string, uploadsRoot: string, now: number, maxAgeMs: number): Promise<CleanupResult> {
  let deletedFiles = 0;
  let freedBytes   = 0;
  let expiredRows  = 0;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    logger.warn(`[Cleanup] No se pudo leer el directorio: ${dir}`);
    return { deletedFiles, freedBytes, expiredRows };
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const sub = await scanAndDelete(fullPath, uploadsRoot, now, maxAgeMs);
      deletedFiles += sub.deletedFiles;
      freedBytes   += sub.freedBytes;
      expiredRows  += sub.expiredRows;
      continue;
    }

    if (!entry.isFile()) continue;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      logger.warn(`[Cleanup] No se pudo leer el stat de: ${fullPath}`);
      continue;
    }

    const ageMs = now - stat.mtimeMs;
    if (ageMs <= maxAgeMs) continue;

    try {
      fs.unlinkSync(fullPath);
      deletedFiles++;
      freedBytes += stat.size;
    } catch (err) {
      logger.warn(`[Cleanup] No se pudo borrar ${fullPath}: ${(err as Error).message}`);
      continue;
    }

    if (await markVariationExpired(uploadsRoot, fullPath)) expiredRows++;
  }

  return { deletedFiles, freedBytes, expiredRows };
}

// Marca en visual_variations.expired_at el momento en que se borró su archivo,
// para que el frontend muestre un estado explícito en vez de un link roto.
// Matchea por archivo individual (misma conversión path→url que filePathToUrl
// en strategies/variations.service.ts) — nunca un UPDATE masivo por carpeta o
// antigüedad. Un archivo sin fila asociada (p. ej. temporales _tmp_* de
// staging, o descargas crudas de uploads/videos/) no hace match — no es un
// error, simplemente no hay nada que actualizar.
async function markVariationExpired(uploadsRoot: string, deletedFilePath: string): Promise<boolean> {
  const url = `/uploads/${path.relative(uploadsRoot, deletedFilePath).replace(/\\/g, '/')}`;
  try {
    const rows = await query<{ id: string }>(
      `UPDATE visual_variations SET expired_at = NOW() WHERE url = $1 RETURNING id`,
      [url],
    );
    return rows.length > 0;
  } catch (err) {
    logger.warn(`[Cleanup] No se pudo marcar expirado en DB para ${url}: ${(err as Error).message}`);
    return false;
  }
}

// Remove directories that are now empty (bottom-up, leaves first).
function removeEmptyDirs(dir: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      removeEmptyDirs(path.join(dir, entry.name));
    }
  }

  try {
    const remaining = fs.readdirSync(dir);
    if (remaining.length === 0) fs.rmdirSync(dir);
  } catch {
    // best-effort
  }
}
