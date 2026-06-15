import { Request, Response, NextFunction } from 'express';
import * as postsService from './posts.service';

// ── Campaign-level handlers ────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const posts = await postsService.listPosts(req.params.campaignId, req.user!.userId);
    res.json({ posts });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await postsService.createPost(
      req.params.campaignId,
      req.user!.userId,
      req.body,
    );
    res.status(201).json({ post });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await postsService.updatePost(
      req.params.postId,
      req.params.campaignId,
      req.user!.userId,
      req.body,
    );
    res.json({ post });
  } catch (err) { next(err); }
}

// ── Post-level wizard handlers ─────────────────────────────────────────────

export async function getPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await postsService.getPost(req.params.postId, req.user!.userId);
    res.json({ post });
  } catch (err) { next(err); }
}

export async function updateDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await postsService.updateDescription(
      req.params.postId,
      req.user!.userId,
      req.body,
    );
    res.json({ post });
  } catch (err) { next(err); }
}

export async function generateCopyOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { lang } = (req.body ?? {}) as { lang?: string };
    const result = await postsService.generateCopyOptions(
      req.params.postId,
      req.user!.userId,
      lang,
    );
    res.json(result);
  } catch (err) { next(err); }
}

export async function selectCopyOption(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { strategy_id } = req.body as { strategy_id: string };
    if (!strategy_id) { res.status(400).json({ error: 'strategy_id requerido' }); return; }

    const post = await postsService.selectCopyOption(
      req.params.postId,
      req.user!.userId,
      strategy_id,
    );
    res.json({ post });
  } catch (err) { next(err); }
}

export async function selectCopyWithPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { strategy_id } = req.body as { strategy_id: string };
    if (!strategy_id) { res.status(400).json({ error: 'strategy_id requerido' }); return; }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) { res.status(400).json({ error: 'Sube al menos 1 foto' }); return; }

    const photoBuffers = files.map(f => f.buffer);
    const post = await postsService.selectCopyWithPhotos(
      req.params.postId,
      req.user!.userId,
      strategy_id,
      photoBuffers,
    );
    res.json({ post });
  } catch (err) { next(err); }
}

export async function selectVisual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { visual_variation_id } = req.body as { visual_variation_id: string };
    if (!visual_variation_id) { res.status(400).json({ error: 'visual_variation_id requerido' }); return; }

    const post = await postsService.selectVisual(
      req.params.postId,
      req.user!.userId,
      visual_variation_id,
    );
    res.json({ post });
  } catch (err) { next(err); }
}

export async function confirmPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('[confirmPost controller] req.body:', JSON.stringify(req.body));
    const { overlay_logo = false, overlay_copy = false } = (req.body ?? {}) as {
      overlay_logo?: boolean;
      overlay_copy?: boolean;
    };
    const { post, variationUrl } = await postsService.confirmPost(
      req.params.postId,
      req.user!.userId,
      !!overlay_logo,
      !!overlay_copy,
    );
    res.json({ post, variationUrl });
  } catch (err) { next(err); }
}
