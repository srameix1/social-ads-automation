import { Request, Response, NextFunction } from 'express';
import * as clientsService from './clients.service';
import { getPublicUrl } from '../../utils/storage';

export async function updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan } = req.body as { plan: 'basic' | 'professional' | 'premium' };
    if (!['basic', 'professional', 'premium'].includes(plan)) {
      res.status(400).json({ error: 'Plan inválido' }); return;
    }
    const profile = await clientsService.updatePlan(req.user!.userId, plan);
    res.json({ profile });
  } catch (err) { next(err); }
}

export async function updateBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { brand_primary_color, brand_secondary_color, brand_font } = req.body as Record<string, string>;
    const profile = await clientsService.updateBrand(req.user!.userId, {
      primaryColor:   brand_primary_color,
      secondaryColor: brand_secondary_color,
      font:           brand_font,
    });
    res.json({ profile });
  } catch (err) { next(err); }
}

export async function uploadBrandLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'Archivo de logo requerido' }); return; }
    const url     = getPublicUrl(req, file.filename);
    const profile = await clientsService.updateBrandLogo(req.user!.userId, url);
    res.json({ profile });
  } catch (err) { next(err); }
}

export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await clientsService.getProfile(req.user!.userId);
    res.json({ profile });
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { business_name, description } = req.body;
    if (!business_name) { res.status(400).json({ error: 'Nombre del negocio requerido' }); return; }

    const profile = await clientsService.updateProfile(req.user!.userId, business_name, description ?? '');
    res.json({ profile });
  } catch (err) { next(err); }
}

export async function uploadPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    const url = (key: string) =>
      files?.[key]?.[0] ? getPublicUrl(req, files[key][0].filename) : null;

    const profile = await clientsService.updatePhotos(
      req.user!.userId,
      url('photo_1'),
      url('photo_2'),
      url('photo_3'),
    );
    res.json({ profile });
  } catch (err) { next(err); }
}
