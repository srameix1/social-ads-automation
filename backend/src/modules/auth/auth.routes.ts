import { Router } from 'express';
import * as controller from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/register',     controller.register);
router.post('/login',        controller.login);
router.post('/logout',       controller.logout);
router.get('/verify-email',  controller.verifyEmail);
router.get('/me',            authenticate, controller.me);

export default router;
