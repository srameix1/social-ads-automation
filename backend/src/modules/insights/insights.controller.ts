import { Request, Response, NextFunction } from 'express';
import * as insightsService from './insights.service';

export async function getCampaignInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaignId = req.params['campaignId'];
    const refresh = req.query['refresh'] === '1' || req.query['refresh'] === 'true';
    const result = await insightsService.getCampaignInsights(req.user!.userId, campaignId, refresh);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
