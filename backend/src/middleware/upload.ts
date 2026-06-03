import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { getUploadsDir } from '../utils/storage';
import { env } from '../config/env';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getUploadsDir()),
  filename: (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${ext}`);
  },
});

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPEG, PNG o WebP'));
  }
}

export const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE },
}).fields([
  { name: 'photo_1', maxCount: 1 },
  { name: 'photo_2', maxCount: 1 },
  { name: 'photo_3', maxCount: 1 },
]);

/** Sube un solo archivo con el nombre de campo especificado. */
export const uploadSingle = (fieldName: string) =>
  multer({ storage, fileFilter, limits: { fileSize: env.MAX_FILE_SIZE } }).single(fieldName);
