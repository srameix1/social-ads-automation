import { Router } from 'express';
import * as controller from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';

const router = Router();

router.post('/register',             controller.register);
router.post('/login',                controller.login);
router.post('/logout',               controller.logout);
router.post('/resend-verification',  controller.resendVerification);
router.get('/verify-email',          controller.verifyEmail);
router.get('/me',                    authenticate, controller.me);

// 2FA (TOTP) — sólo cuentas admin.
router.post('/2fa/setup',        authenticate, authorize('admin'), controller.setupTotp);
router.post('/2fa/verify-setup', authenticate, authorize('admin'), controller.verifyTotpSetup);

export default router;
