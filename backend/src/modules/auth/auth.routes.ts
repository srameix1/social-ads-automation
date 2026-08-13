import { Router } from 'express';
import * as controller from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';

const router = Router();

router.post('/register',             controller.register);
router.post('/login',                controller.login);
router.post('/login/verify-2fa',     controller.verifyLoginTwoFactor);
router.post('/logout',               controller.logout);
router.post('/resend-verification',  controller.resendVerification);
router.get('/verify-email',          controller.verifyEmail);
router.get('/me',                    authenticate, controller.me);

// 2FA (TOTP) — sólo cuentas admin. /login/verify-2fa (arriba) es la excepción
// a propósito: no lleva `authenticate` porque todavía no hay sesión en ese
// paso — se autentica con el pendingToken que emitió /login, no con la
// cookie/Authorization habituales.
router.post('/2fa/setup',        authenticate, authorize('admin'), controller.setupTotp);
router.post('/2fa/verify-setup', authenticate, authorize('admin'), controller.verifyTotpSetup);
router.post('/2fa/disable',      authenticate, authorize('admin'), controller.disableTotp);

export default router;
