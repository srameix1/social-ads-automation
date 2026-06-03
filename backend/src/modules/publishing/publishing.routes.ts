import { Router } from 'express';
import * as controller from './publishing.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorize('client'));

router.get('/', controller.getPublications);

export default router;
