import { Request, Response, NextFunction } from 'express';
import * as campaignsService from './campaigns.service';
import { validateTextField } from '../../utils/validation';

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
      business_problem: rawBusinessProblem,
      differentiator:   rawDifferentiator,
      ideal_client:     rawIdealClient,
      concrete_result:  rawConcreteResult,
      client_pain:      rawClientPain,
    } = req.body as {
      title:             string;
      platforms:         string[];
      month_year?:       string;
      business_problem?: unknown;
      differentiator?:   unknown;
      ideal_client?:     unknown;
      concrete_result?:  unknown;
      client_pain?:      unknown;
    };

    if (!title) { res.status(400).json({ error: 'Título requerido' }); return; }
    if (!Array.isArray(platforms) || !platforms.length) {
      res.status(400).json({ error: 'Selecciona al menos una plataforma' }); return;
    }

    const businessProblem = validateTextField(rawBusinessProblem, 'business_problem');
    const differentiator  = validateTextField(rawDifferentiator, 'differentiator');
    const idealClient     = validateTextField(rawIdealClient, 'ideal_client');
    const concreteResult  = validateTextField(rawConcreteResult, 'concrete_result');
    const clientPain      = validateTextField(rawClientPain, 'client_pain');

    const monthYear = month_year || new Date().toISOString().slice(0, 7);

    const campaign = await campaignsService.createCampaign(
      req.user!.userId, title, platforms, monthYear,
      { businessProblem, differentiator, idealClient, concreteResult, clientPain },
    );
    res.status(201).json({ campaign });
  } catch (err) { next(err); }
}
