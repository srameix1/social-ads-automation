import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { getUploadsDir, getLogosDir } from '../utils/storage';
import { env } from '../config/env';
import { validateFileContent } from './validateFileContent';

const PHOTO_ERROR_MESSAGE = 'Solo se permiten imágenes JPEG, PNG o WebP';
const LOGO_ERROR_MESSAGE  = 'Solo se permiten imágenes JPEG, PNG, WebP o SVG';

// Segunda pasada, DESPUÉS de multer: valida los magic bytes reales del
// archivo ya subido (disco o memoria) contra la misma whitelist que
// fileFilter/logoFilter, ignorando el Content-Type que declaró el cliente.
const validatePhotoContent = validateFileContent({
  allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  errorMessage: PHOTO_ERROR_MESSAGE,
});

const validateLogoContent = validateFileContent({
  allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  errorMessage: LOGO_ERROR_MESSAGE,
});

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
    cb(new Error(PHOTO_ERROR_MESSAGE));
  }
}

export const uploadPhotos = [
  multer({
    storage,
    fileFilter,
    limits: { fileSize: env.MAX_FILE_SIZE },
  }).fields([
    { name: 'photo_1', maxCount: 1 },
    { name: 'photo_2', maxCount: 1 },
    { name: 'photo_3', maxCount: 1 },
  ]),
  validatePhotoContent,
];

/** Sube un solo archivo con el nombre de campo especificado. */
export const uploadSingle = (fieldName: string) => [
  multer({ storage, fileFilter, limits: { fileSize: env.MAX_FILE_SIZE } }).single(fieldName),
  validatePhotoContent,
];

/** Logo del negocio — JPG, PNG, WebP o SVG, máx 2 MB, guardado en uploads/logos/. */
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getLogosDir()),
  filename:    (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase() || '.png';
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${ext}`);
  },
});

const logoFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(LOGO_ERROR_MESSAGE));
  }
};

export const uploadLogo = [
  multer({
    storage:    logoStorage,
    fileFilter: logoFilter,
    limits:     { fileSize: 2 * 1024 * 1024 },
  }).single('logo'),
  validateLogoContent,
];

/** Hasta 6 fotos de variaciones — en memoria para procesado inmediato (no se guardan a disco). */
export const uploadVariationPhotos = [
  multer({
    storage:    multer.memoryStorage(),
    fileFilter,
    limits:     { fileSize: env.MAX_FILE_SIZE },
  }).array('photos', 6),
  validatePhotoContent,
];
