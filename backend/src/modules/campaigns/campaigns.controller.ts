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
  try {
    const {
      title, platforms, month_year,
      business_problem, differentiator, ideal_client, concrete_result, client_pain,
    } = req.body as {
      title:             string;
      platforms:         string[];
      month_year?:       string;
      business_problem?: string;
      differentiator?:   string;
      ideal_client?:     string;
      concrete_result?:  string;
      client_pain?:      string;
    };

    if (!title) { res.status(400).json({ error: 'Título requerido' }); return; }
    if (!Array.isArray(platforms) || !platforms.length) {
      res.status(400).json({ error: 'Selecciona al menos una plataforma' }); return;
    }

    const monthYear = month_year || new Date().toISOString().slice(0, 7);

    const campaign = await campaignsService.createCampaign(
      req.user!.userId, title, platforms, monthYear,
      { businessProblem: business_problem, differentiator, idealClient: ideal_client, concreteResult: concrete_result, clientPain: client_pain },
    );
    res.status(201).json({ campaign });
  } catch (err) { next(err); }
}
