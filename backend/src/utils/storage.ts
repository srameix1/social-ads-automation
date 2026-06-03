import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { Request } from 'express';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getUploadsDir(): string {
  const dir = path.resolve(env.UPLOADS_DIR);
  ensureDir(dir);
  return dir;
}

export function getFilePath(filename: string): string {
  return path.join(getUploadsDir(), filename);
}

export function getPublicUrl(req: Request, filename: string): string {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

export function deleteFile(filename: string): void {
  const filePath = getFilePath(filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
