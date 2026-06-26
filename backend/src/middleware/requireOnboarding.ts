import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../config/database';

interface OnboardingRow {
  plan_selected_at: string | null;
  has_creds: boolean;
}

export async function requireOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || req.user.role !== 'client') { next(); return; }

  const path = req.originalUrl.split('?')[0];

  let row: OnboardingRow | null;
  try {
    row = await queryOne<OnboardingRow>(
      `SELECT cp.plan_selected_at,
              EXISTS(SELECT 1 FROM client_credentials cc WHERE cc.client_id = $1) AS has_creds
       FROM client_profiles cp WHERE cp.user_id = $1`,
      [req.user.userId],
    );
  } catch { next(); return; }

  if (!row) { next(); return; }

  if (!row.plan_selected_at) {
    const exempt = path === '/api/clients/select-plan' || path.startsWith('/api/auth/');
    if (!exempt) { res.status(403).json({ error: 'PLAN_REQUIRED' }); return; }
  }

  if (row.plan_selected_at && !row.has_creds) {
    const exempt =
      path.startsWith('/api/oauth/') ||
      path === '/api/credentials' ||
      path.startsWith('/api/auth/');
    if (!exempt) { res.status(403).json({ error: 'CONNECTION_REQUIRED' }); return; }
  }

  next();
}
