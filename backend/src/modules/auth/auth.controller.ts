import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son requeridos' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }

    const result = await authService.register(email, password);
    setAuthCookies(res, result.token, result.user);
    res.status(201).json({ user: result.user, token: result.token });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son requeridos' });
      return;
    }

    const result = await authService.login(email, password);
    setAuthCookies(res, result.token, result.user);
    res.json({ user: result.user, token: result.token });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('auth_token');
  res.clearCookie('user_role');
  res.json({ message: 'Sesión cerrada' });
}

function setAuthCookies(res: Response, token: string, user: { role: string }): void {
  res.cookie('auth_token', token, COOKIE_OPTIONS);
  res.cookie('user_role',  user.role, { ...COOKIE_OPTIONS, httpOnly: false });
}
