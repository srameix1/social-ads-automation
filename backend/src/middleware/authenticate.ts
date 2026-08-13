import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../config/database';

export interface JwtPayload {
  userId: string;
  email:  string;
  role:   'client' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token de autenticación requerido' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return;
  }

  // El pendingToken que login() emite para admins con 2FA activo se firma
  // con el MISMO JWT_SECRET (para no manejar dos secretos), pero sólo sirve
  // para POST /api/auth/login/verify-2fa — nunca debe pasar como sesión acá,
  // o alguien con ese token (sin haber completado 2FA) tendría acceso
  // completo a la API.
  if ((payload as unknown as Record<string, unknown>).pending2FA === true) {
    res.status(401).json({ error: 'Verificación de dos factores pendiente' });
    return;
  }

  // Verify the user still exists in the database.
  // A valid JWT for a deleted/non-existent user would otherwise cause FK violations downstream.
  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = TRUE',
      [payload.userId],
    );
    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Sesión inválida. Por favor inicia sesión de nuevo.' });
      return;
    }
  } catch {
    res.status(500).json({ error: 'Error verificando sesión' });
    return;
  }

  req.user = payload;
  next();
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  const cookie = req.cookies?.auth_token;
  if (cookie) return cookie;

  return null;
}
