import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { billingController } from './billing.controller';

const router = Router();

// Stripe webhook — raw body applied in app.ts BEFORE express.json()
router.post('/webhook', billingController.webhook);

// Protected billing routes
router.get('/status',    authenticate, authorize('client'), billingController.getStatus);
router.post('/checkout', authenticate, authorize('client'), billingController.createCheckout);
router.post('/portal',   authenticate, authorize('client'), billingController.createPortal);
router.post('/cancel',   authenticate, authorize('client'), billingController.cancelSubscription);

export default router;
