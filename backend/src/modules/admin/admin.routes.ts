import { Router } from 'express';
import * as controller from './admin.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats',                  controller.stats);
router.get('/clients',                controller.listClients);
router.get('/clients/:id',            controller.getClient);
router.patch('/clients/:id',          controller.updateClient);
router.get('/campaigns',              controller.listCampaigns);
router.get('/campaigns/:id',          controller.getCampaign);
router.patch('/campaigns/:id/max-posts', controller.updateCampaignMaxPosts);
router.get('/plan-limits',            controller.getPlanLimits);
router.put('/plan-limits/:plan',      controller.updatePlanLimit);

export default router;
