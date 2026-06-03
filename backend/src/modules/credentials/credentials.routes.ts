import { Router } from 'express';
import * as controller from './credentials.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize('client'));

router.get('/',                controller.list);
router.post('/:platform',      controller.save);
router.delete('/:platform',    controller.remove);

export default router;
