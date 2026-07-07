import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await adminService.getStats()); } catch (err) { next(err); }
}

export async function listClients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ clients: await adminService.getAllClients() }); } catch (err) { next(err); }
}

export async function getClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ client: await adminService.getClientDetail(req.params.id) }); } catch (err) { next(err); }
}

export async function updateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { trial_posts_limit, admin_notes } = req.body as { trial_posts_limit?: unknown; admin_notes?: unknown };
    const data: Partial<{ trial_posts_limit: number; admin_notes: string }> = {};

    if (trial_posts_limit !== undefined) {
      const val = parseInt(trial_posts_limit as string, 10);
      if (isNaN(val) || val < 0) {
        res.status(400).json({ error: 'trial_posts_limit debe ser un número no negativo' });
        return;
      }
      data.trial_posts_limit = val;
    }
    if (admin_notes !== undefined) {
      data.admin_notes = String(admin_notes);
    }

    await adminService.updateClient(req.params.id, data);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ campaigns: await adminService.getAllCampaigns() }); } catch (err) { next(err); }
}

export async function getCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ campaign: await adminService.getCampaignDetail(req.params.id) }); } catch (err) { next(err); }
}

export async function getPlanLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ planLimits: await adminService.getPlanLimits() }); } catch (err) { next(err); }
}

export async function updatePlanLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await adminService.updatePlanLimit(req.params.plan, req.body);
    res.json({ planLimit: updated });
  } catch (err) { next(err); }
}

export async function updateCampaignMaxPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const maxPosts = parseInt(req.body.max_posts);
    if (isNaN(maxPosts) || maxPosts < 1) {
      res.status(400).json({ error: 'max_posts debe ser un número positivo' });
      return;
    }
    await adminService.updateCampaignMaxPosts(req.params.id, maxPosts);
    res.json({ success: true });
  } catch (err) { next(err); }
}

const VALID_COURTESY_PLANS = ['basic', 'professional', 'premium'];

export async function updateCourtesy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { is_courtesy, courtesy_plan, courtesy_expires_at } = req.body as {
      is_courtesy?:         unknown;
      courtesy_plan?:       unknown;
      courtesy_expires_at?: unknown;
    };
    const data: adminService.CourtesyUpdate = {};

    if (is_courtesy !== undefined) {
      if (typeof is_courtesy !== 'boolean') {
        res.status(400).json({ error: 'is_courtesy debe ser boolean' });
        return;
      }
      data.is_courtesy = is_courtesy;
    }

    if (courtesy_plan !== undefined) {
      if (courtesy_plan !== null && !VALID_COURTESY_PLANS.includes(courtesy_plan as string)) {
        res.status(400).json({ error: `courtesy_plan debe ser uno de: ${VALID_COURTESY_PLANS.join(', ')}` });
        return;
      }
      data.courtesy_plan = courtesy_plan as string | null;
    }

    if (courtesy_expires_at !== undefined) {
      if (courtesy_expires_at !== null && isNaN(Date.parse(courtesy_expires_at as string))) {
        res.status(400).json({ error: 'courtesy_expires_at debe ser una fecha válida' });
        return;
      }
      data.courtesy_expires_at = courtesy_expires_at as string | null;
    }

    if (data.is_courtesy === true) {
      if (!data.courtesy_plan) {
        res.status(400).json({ error: 'courtesy_plan es requerido para activar la cortesía' });
        return;
      }
      if (!data.courtesy_expires_at) {
        res.status(400).json({ error: 'courtesy_expires_at es requerido para activar la cortesía' });
        return;
      }
    }

    // Al desactivar cortesía sin especificar plan, limpiarlo — mismo comportamiento que la revocación automática.
    if (data.is_courtesy === false && data.courtesy_plan === undefined) {
      data.courtesy_plan = null;
    }

    await adminService.updateCourtesy(req.params.id, data);
    res.json({ success: true });
  } catch (err) { next(err); }
}
