import { Request, Response, NextFunction } from 'express';
import * as variationsService from './variations.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const variations = await variationsService.getVariations(campaignId, req.user!.userId);
    res.json({ variations });
  } catch (err) { next(err); }
}

export async function select(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId, variationId } = req.params;
    await variationsService.selectVariation(campaignId, variationId, req.user!.userId);
    res.json({ message: 'Variación seleccionada. Publicando…' });
  } catch (err) { next(err); }
}
