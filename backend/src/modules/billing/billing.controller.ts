import { Request, Response, NextFunction } from 'express';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  cancelSubscription,
  handleWebhook,
} from './billing.service';

export const billingController = {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await getSubscriptionStatus(req.user!.userId);
      res.json(status);
    } catch (err) { next(err); }
  },

  async createCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { plan } = req.body as { plan: string };
      if (!plan) { res.status(400).json({ error: 'Plan requerido' }); return; }
      const url = await createCheckoutSession(req.user!.userId, req.user!.email, plan);
      res.json({ url });
    } catch (err) { next(err); }
  },

  async createPortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = await createPortalSession(req.user!.userId);
      res.json({ url });
    } catch (err) { next(err); }
  },

  async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await cancelSubscription(req.user!.userId);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async webhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) { res.status(400).json({ error: 'Missing stripe-signature header' }); return; }
    try {
      await handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
