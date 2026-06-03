import { Request, Response, NextFunction } from 'express';
import * as publishingService from './publishing.service';

export async function getPublications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const publications = await publishingService.getPublications(
      req.params.campaignId,
      req.user!.userId,
    );
    res.json({ publications });
  } catch (err) { next(err); }
}
