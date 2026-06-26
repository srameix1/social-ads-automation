import { Router } from 'express';
import * as controller from './posts.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { uploadVariationPhotos } from '../../middleware/upload';
import { requireOnboarding } from '../../middleware/requireOnboarding';

// ── Campaign-level routes — mounted at /api/campaigns/:campaignId/posts ────
const campaignPostsRouter = Router({ mergeParams: true });

campaignPostsRouter.use(authenticate);
campaignPostsRouter.use(authorize('client'));
campaignPostsRouter.use(requireOnboarding);

campaignPostsRouter.get('/',          controller.list);
campaignPostsRouter.post('/',         controller.create);
campaignPostsRouter.patch('/:postId', controller.update);

export default campaignPostsRouter;

// ── Top-level post wizard routes — mounted at /api/posts ──────────────────
export const postActionsRouter = Router();

postActionsRouter.use(authenticate);
postActionsRouter.use(authorize('client'));
postActionsRouter.use(requireOnboarding);

postActionsRouter.get('/:postId',                                           controller.getPost);
postActionsRouter.patch('/:postId/description',                             controller.updateDescription);
postActionsRouter.post('/:postId/generate-copy',                            controller.generateCopyOptions);
postActionsRouter.post('/:postId/select-copy',                              controller.selectCopyOption);
postActionsRouter.post('/:postId/select-copy-with-photos', uploadVariationPhotos, controller.selectCopyWithPhotos);
postActionsRouter.patch('/:postId/select-visual',                           controller.selectVisual);
postActionsRouter.post('/:postId/confirm',                                  controller.confirmPost);
