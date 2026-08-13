import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { sniffImageType, SniffableImageType } from '../utils/fileTypeSniffer';

/**
 * Multer llama a fileFilter ANTES de leer el body del archivo — en disco y
 * en memoria por igual — así que ahí nunca hay bytes disponibles para
 * inspeccionar. Este middleware corre DESPUÉS de multer, cuando el archivo
 * ya está completo (en disco vía file.path, o en memoria vía file.buffer),
 * y valida el contenido real contra la whitelist — ignorando el
 * Content-Type que declaró el cliente.
 */
export function validateFileContent(opts: {
  allowedMimes: SniffableImageType[];
  errorMessage: string;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = collectFiles(req);
    if (!files.length) { next(); return; }

    try {
      let rejected = false;

      for (const file of files) {
        const buffer = file.buffer ?? (await fs.readFile(file.path));
        const detected = sniffImageType(buffer);
        if (!detected || !opts.allowedMimes.includes(detected)) rejected = true;
      }

      if (rejected) {
        await Promise.all(files.map((f) => deleteIfOnDisk(f.path)));
        res.status(400).json({ error: opts.errorMessage });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function collectFiles(req: Request): Express.Multer.File[] {
  if (req.file) return [req.file];
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
}

async function deleteIfOnDisk(filePath: string | undefined): Promise<void> {
  if (!filePath) return; // memoryStorage: nunca se escribió a disco
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
