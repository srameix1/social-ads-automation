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
