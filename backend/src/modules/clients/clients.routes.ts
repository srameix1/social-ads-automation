import { Router } from 'express';
import * as controller from './clients.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { uploadPhotos, uploadSingle } from '../../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(authorize('client'));

router.get('/profile',              controller.getMyProfile);
router.put('/profile',              controller.updateProfile);
router.post('/profile/photos',      uploadPhotos,         controller.uploadPhotos);
router.put('/profile/plan',                               controller.updatePlan);
router.put('/profile/brand',                              controller.updateBrand);
router.post('/profile/brand/logo',  uploadSingle('logo'), controller.uploadBrandLogo);

export default router;
