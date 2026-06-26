import { Router } from 'express';
import * as controller from './campaigns.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOnboarding } from '../../middleware/requireOnboarding';

const router = Router();

router.use(authenticate);
router.use(authorize('client'));
router.use(requireOnboarding);

router.get('/',    controller.list);
router.post('/',   controller.create);
router.get('/:id', controller.getOne);

export default router;
