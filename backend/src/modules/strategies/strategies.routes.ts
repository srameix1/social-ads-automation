import { Router } from 'express';
import * as controller from './strategies.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorize('client'));

router.post('/:strategyId/select', controller.selectStrategy);
router.post('/retry',               controller.retryPublishing);

export default router;
