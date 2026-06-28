import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export function createError(message: string, statusCode: number, code?: string): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  if (code) err.code = code;
  return err;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status  = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';

  if (status >= 500) {
    logger.error(err.message, { stack: err.stack });
  } else {
    logger.warn(err.message);
  }

  if (err.code) {
    res.status(status).json({ error: err.code, message });
  } else {
    res.status(status).json({ error: message });
  }
}
