import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { oauthController } from './oauth.controller';

const router = Router();

// Init endpoints — require auth (called as API, return { url })
router.post('/facebook/init',       authenticate, authorize('client'), oauthController.initFacebook);
router.post('/tiktok/init',         authenticate, authorize('client'), oauthController.initTikTok);

// Disconnect
router.delete('/disconnect/:platform', authenticate, authorize('client'), oauthController.disconnect);

// Page selector (no auth — validated via signed JWT token in body/query)
router.get('/facebook/pages',       oauthController.getFacebookPages);
router.post('/facebook/select-page', oauthController.selectPage);

// OAuth callbacks — called by social platforms (no auth, validate state JWT)
router.get('/facebook/callback',    oauthController.facebookCallback);
router.get('/tiktok/callback',      oauthController.tiktokCallback);

export default router;
