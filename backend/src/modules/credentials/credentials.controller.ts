import { Request, Response, NextFunction } from 'express';
import * as credentialsService from './credentials.service';

type Platform = 'instagram' | 'tiktok' | 'facebook';
const VALID_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'facebook'];

function validatePlatform(platform: string): platform is Platform {
  return VALID_PLATFORMS.includes(platform as Platform);
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const credentials = await credentialsService.listCredentials(req.user!.userId);
    res.json({ credentials });
  } catch (err) { next(err); }
}

export async function save(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { platform } = req.params;
    if (!validatePlatform(platform)) {
      res.status(400).json({ error: 'Plataforma inválida. Usa: instagram, tiktok, facebook' });
      return;
    }

    const creds = req.body;
    if (!creds || typeof creds !== 'object' || Object.keys(creds).length === 0) {
      res.status(400).json({ error: 'Credenciales requeridas en el body' });
      return;
    }

    await credentialsService.saveCredentials(req.user!.userId, platform, creds);
    res.json({ message: `Credenciales de ${platform} guardadas correctamente` });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { platform } = req.params;
    if (!validatePlatform(platform)) {
      res.status(400).json({ error: 'Plataforma inválida' });
      return;
    }
    await credentialsService.deleteCredentials(req.user!.userId, platform);
    res.json({ message: `Credenciales de ${platform} eliminadas` });
  } catch (err) { next(err); }
}
