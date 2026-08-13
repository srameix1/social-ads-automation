import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días
  // Leading dot makes the cookie valid on spotflow.pro AND api.spotflow.pro
  // (frontend and backend are on different subdomains) — without this,
  // middleware.ts on the frontend can never see the session cookie, since a
  // cookie with no explicit domain is scoped only to the host that set it.
  // undefined in dev: localhost has no real domain to scope a dot-cookie to.
  domain: env.NODE_ENV === 'production' ? '.spotflow.pro' : undefined,
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

    const result = await authService.register(email, password, req.ip);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.query['token'];
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Token requerido' });
      return;
    }

    const result = await authService.verifyEmail(token);
    setAuthCookies(res, result.token, result.user);
    res.json({ user: result.user, token: result.token });
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

    const result = await authService.login(email, password, req.ip!);

    if ('requiresTwoFactor' in result) {
      // Todavía no hay sesión — nada de cookies acá. El cliente tiene que
      // completar POST /api/auth/login/verify-2fa con este pendingToken.
      res.json({ requires_2fa: true, pendingToken: result.pendingToken });
      return;
    }

    setAuthCookies(res, result.token, result.user);
    res.json({ user: result.user, token: result.token });
  } catch (err) {
    next(err);
  }
}

export async function verifyLoginTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { pendingToken, code } = req.body as { pendingToken?: unknown; code?: unknown };
    if (!pendingToken || typeof pendingToken !== 'string' || !code || typeof code !== 'string') {
      res.status(400).json({ error: 'pendingToken y code son requeridos' });
      return;
    }

    const result = await authService.verifyLoginTwoFactor(pendingToken, code, req.ip!);
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

export async function setupTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.setupTotp(req.user!.userId, req.user!.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyTotpSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.body as { code?: unknown };
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Código requerido' });
      return;
    }

    const result = await authService.verifyTotpSetup(req.user!.userId, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function disableTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { password, code } = req.body as { password?: unknown; code?: unknown };
    if (!password || typeof password !== 'string' || !code || typeof code !== 'string') {
      res.status(400).json({ error: 'password y code son requeridos' });
      return;
    }

    const result = await authService.disableTotp(req.user!.userId, password, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as { email?: unknown };
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email requerido' });
      return;
    }
    const result = await authService.resendVerification(email.trim().toLowerCase());
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  // clearCookie must be called with the same `domain` used to set the
  // cookie, or the browser won't match it — it would just set a new,
  // already-expired cookie on the default (no-domain) scope, leaving the
  // real .spotflow.pro-scoped cookie orphaned and still valid until it
  // naturally expires.
  res.clearCookie('auth_token', { domain: COOKIE_OPTIONS.domain });
  res.clearCookie('user_role',  { domain: COOKIE_OPTIONS.domain });
  res.json({ message: 'Sesión cerrada' });
}

function setAuthCookies(res: Response, token: string, user: { role: string }): void {
  res.cookie('auth_token', token, COOKIE_OPTIONS);
  res.cookie('user_role',  user.role, { ...COOKIE_OPTIONS, httpOnly: false });
}
