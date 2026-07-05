import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

import authRoutes        from './modules/auth/auth.routes';
import clientRoutes      from './modules/clients/clients.routes';
import credentialRoutes  from './modules/credentials/credentials.routes';
import campaignRoutes    from './modules/campaigns/campaigns.routes';
import strategyRoutes    from './modules/strategies/strategies.routes';
import publishingRoutes  from './modules/publishing/publishing.routes';
import adminRoutes       from './modules/admin/admin.routes';
import oauthRoutes       from './modules/oauth/oauth.routes';
import billingRoutes     from './modules/billing/billing.routes';
import variationsRoutes  from './modules/variations/variations.routes';
import postsRoutes, { postActionsRouter } from './modules/posts/posts.routes';

const app = express();

// Trust the reverse proxy (EasyPanel) in front of this app — required for
// req.ip / X-Forwarded-For to resolve to the real client IP instead of the
// proxy's internal address (used for registration_ip capture at signup).
app.set('trust proxy', 1);

// ── Seguridad ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://api.spotflow.pro'],
    },
  },
}));
app.use(cors({
  origin:               [env.FRONTEND_URL, 'https://spotflow.pro', 'http://localhost:3000'],
  credentials:          true,
  methods:              ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:       ['Content-Type', 'Authorization', 'Cookie'],
  preflightContinue:    false,
  optionsSuccessStatus: 204,
}));

// Manejar preflight explícitamente
app.options('*', cors());

// ── Stripe webhook necesita body crudo — ANTES de express.json() ──────────
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// ── Parsing ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Archivos estáticos (fotos subidas) ────────────────────────────────────
// Override Helmet's default Cross-Origin-Resource-Policy: same-origin so the
// Next.js frontend (different port) can load images from this Express server.
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.resolve(env.UPLOADS_DIR)));

// ── Request logging ────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/auth',                                  authRoutes);
app.use('/api/clients',                               clientRoutes);
app.use('/api/credentials',                           credentialRoutes);
app.use('/api/campaigns',                             campaignRoutes);
app.use('/api/campaigns/:campaignId/strategies',      strategyRoutes);
app.use('/api/campaigns/:campaignId/variations',      variationsRoutes);
app.use('/api/campaigns/:campaignId/posts',           postsRoutes);
app.use('/api/posts',                                 postActionsRouter);
app.use('/api/campaigns/:campaignId/publications',    publishingRoutes);
app.use('/api/admin',                                 adminRoutes);
app.use('/api/oauth',                                 oauthRoutes);
app.use('/api/billing',                               billingRoutes);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Error handler (debe ir al final) ──────────────────────────────────────
app.use(errorHandler);

export default app;
