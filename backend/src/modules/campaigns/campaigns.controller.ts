import { Request, Response, NextFunction } from 'express';
import * as campaignsService from './campaigns.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaigns = await campaignsService.listCampaigns(req.user!.userId);
    res.json({ campaigns });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaign = await campaignsService.getCampaign(req.params.id, req.user!.userId);
    res.json({ campaign });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Hard deadline: if the whole process takes longer than 60 s, respond with an error
  // rather than leaving the frontend hanging forever.
  const deadline = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'La generación de estrategias tardó demasiado. Inténtalo de nuevo.' });
    }
  }, 60_000);

  try {
    const { title, objective, target_audience, platforms } = req.body;

    if (!title)         { res.status(400).json({ error: 'Título requerido' }); return; }
    if (!objective)     { res.status(400).json({ error: 'Objetivo requerido' }); return; }
    if (!Array.isArray(platforms) || !platforms.length) {
      res.status(400).json({ error: 'Selecciona al menos una plataforma' }); return;
    }

    const campaign = await campaignsService.createCampaign(
      req.user!.userId, title, objective, target_audience ?? '', platforms,
    );

    if (!res.headersSent) res.status(201).json({ campaign });
  } catch (err) {
    if (!res.headersSent) next(err);
  } finally {
    clearTimeout(deadline);
  }
}
