import { Request, Response, NextFunction } from 'express';
import * as strategiesService from './strategies.service';

export async function selectStrategy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId, strategyId } = req.params;
    await strategiesService.selectStrategy(campaignId, strategyId, req.user!.userId);
    res.json({ message: 'Estrategia seleccionada. Generando contenido y publicando...' });
  } catch (err) { next(err); }
}

export async function retryPublishing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    await strategiesService.retryPublishing(campaignId, req.user!.userId);
    res.json({ message: 'Reintentando publicación...' });
  } catch (err) { next(err); }
}
