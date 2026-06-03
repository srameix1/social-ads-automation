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
