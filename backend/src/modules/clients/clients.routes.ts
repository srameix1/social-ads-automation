import { Router } from 'express';
import * as controller from './clients.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { uploadPhotos, uploadSingle, uploadLogo } from '../../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(authorize('client'));

router.post('/select-plan',                               controller.selectPlan);
router.post('/select-delivery-mode',                      controller.selectDeliveryMode);
router.get('/profile',              controller.getMyProfile);
router.get('/reel-usage',           controller.getReelUsage);
router.get('/attempt-limits',       controller.getAttemptLimits);
router.put('/profile',              controller.updateProfile);
router.post('/profile/photos',      uploadPhotos,         controller.uploadPhotos);
router.put('/profile/plan',                               controller.updatePlan);
router.put('/profile/delivery-mode',                      controller.updateDeliveryMode);
router.put('/profile/brand',                              controller.updateBrand);
router.post('/profile/brand/logo',  uploadLogo,           controller.uploadBrandLogo);

export default router;
