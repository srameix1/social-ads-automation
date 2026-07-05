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
