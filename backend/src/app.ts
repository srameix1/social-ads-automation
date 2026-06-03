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

const app = express();

// ── Seguridad ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      env.FRONTEND_URL,
  credentials: true,
}));

// ── Parsing ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Archivos estáticos (fotos subidas) ────────────────────────────────────
app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR)));

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
app.use('/api/campaigns/:campaignId/publications',    publishingRoutes);
app.use('/api/admin',                                 adminRoutes);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Error handler (debe ir al final) ──────────────────────────────────────
app.use(errorHandler);

export default app;
