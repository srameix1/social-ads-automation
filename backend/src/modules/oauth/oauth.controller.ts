import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  buildFacebookAuthUrl,
  handleFacebookCallback,
  getPendingFacebookPages,
  selectFacebookPage,
  buildTikTokAuthUrl,
  handleTikTokCallback,
  disconnectPlatform,
} from './oauth.service';

export const oauthController = {
  // ── Facebook ─────────────────────────────────────────────────────────────

  async initFacebook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!env.FACEBOOK_APP_ID) {
        res.status(503).json({ error: 'Facebook OAuth no está configurado' });
        return;
      }
      const url = buildFacebookAuthUrl(req.user!.userId);
      logger.info('[OAuth Debug] Facebook auth URL generated', { url });
      res.json({ url });
    } catch (err) { next(err); }
  },

  async facebookCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      const msg = error ?? 'Parámetros OAuth faltantes';
      logger.warn('Facebook OAuth callback error', { error: msg });
      res.redirect(`${env.FRONTEND_URL}/connect?error=${encodeURIComponent(msg)}`);
      return;
    }

    try {
      const redirectUrl = await handleFacebookCallback(code, state);
      res.redirect(redirectUrl);
    } catch (err: any) {
      logger.error('Facebook OAuth callback error', { error: err.message });
      res.redirect(`${env.FRONTEND_URL}/connect?error=${encodeURIComponent(err.message)}`);
    }
  },

  async getFacebookPages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query as { token: string };
      if (!token) { res.status(400).json({ error: 'Token requerido' }); return; }
      const pages = await getPendingFacebookPages(token);
      res.json({ pages });
    } catch (err) { next(err); }
  },

  async selectPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, pageId } = req.body as { token: string; pageId: string };
      if (!token || !pageId) { res.status(400).json({ error: 'token y pageId son requeridos' }); return; }
      await selectFacebookPage(token, pageId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  // ── TikTok ───────────────────────────────────────────────────────────────

  async initTikTok(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!env.TIKTOK_CLIENT_KEY) {
        res.status(503).json({ error: 'TikTok OAuth no está configurado' });
        return;
      }
      const url = buildTikTokAuthUrl(req.user!.userId);
      res.json({ url });
    } catch (err) { next(err); }
  },

  async tiktokCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      const msg = error ?? 'Parámetros OAuth faltantes';
      res.redirect(`${env.FRONTEND_URL}/connect?error=${encodeURIComponent(msg)}`);
      return;
    }

    try {
      await handleTikTokCallback(code, state);
      res.redirect(`${env.FRONTEND_URL}/connect?connected=tiktok`);
    } catch (err: any) {
      logger.error('TikTok OAuth callback error', { error: err.message });
      res.redirect(`${env.FRONTEND_URL}/connect?error=${encodeURIComponent(err.message)}`);
    }
  },

  // ── Disconnect ───────────────────────────────────────────────────────────

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform } = req.params;
      await disconnectPlatform(req.user!.userId, platform);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
};
