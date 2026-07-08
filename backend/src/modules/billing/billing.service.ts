import Stripe from 'stripe';
import { env } from '../../config/env';
import { query, queryOne } from '../../config/database';
import { logger } from '../../utils/logger';
import { createError } from '../../middleware/errorHandler';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

type PlanKey = 'basic' | 'professional' | 'premium';

const PRICE_IDS: Record<PlanKey, string> = {
  basic:        env.STRIPE_PRICE_BASIC,
  professional: env.STRIPE_PRICE_PROFESSIONAL,
  premium:      env.STRIPE_PRICE_PREMIUM,
};

function getPriceId(plan: string): string {
  const priceId = PRICE_IDS[plan as PlanKey];
  if (!priceId) throw new Error(`Plan desconocido: ${plan}`);
  return priceId;
}

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const row = await queryOne<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId],
  );
  if (row?.stripe_customer_id) return row.stripe_customer_id;

  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, userId]);
  return customer.id;
}

export async function createCheckoutSession(userId: string, email: string, plan: string): Promise<string> {
  const priceId    = getPriceId(plan);
  const customerId = await getOrCreateStripeCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer:              customerId,
    client_reference_id:   userId,
    payment_method_types:  ['card'],
    mode:                  'subscription',
    line_items:            [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url:           `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:            `${env.FRONTEND_URL}/select-plan`,
    metadata:              { userId, plan },
    subscription_data:     { metadata: { userId, plan } },
  });

  return session.url!;
}

export async function createPortalSession(userId: string): Promise<string> {
  const row = await queryOne<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId],
  );
  if (!row?.stripe_customer_id) {
    throw new Error('No hay suscripción activa. Selecciona un plan primero.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   row.stripe_customer_id,
    return_url: `${env.FRONTEND_URL}/billing`,
  });
  return session.url;
}

export async function getSubscriptionStatus(userId: string): Promise<{
  plan:               string;
  status:             string;
  subscriptionId:     string | null;
  currentPeriodEnd:   string | null;
  cancelAtPeriodEnd:  boolean;
  pendingPlan:        string | null;
}> {
  const row = await queryOne<{
    plan:                   string;
    stripe_subscription_id: string | null;
    subscription_status:    string;
    cancel_at_period_end:   boolean;
    pending_plan:           string | null;
  }>(
    `SELECT cp.plan, cp.stripe_subscription_id, cp.subscription_status,
            cp.cancel_at_period_end, cp.pending_plan
     FROM client_profiles cp WHERE cp.user_id = $1`,
    [userId],
  );

  let currentPeriodEnd: string | null = null;
  if (row?.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      // current_period_end is a Unix timestamp (number)
      const end = (sub as any).current_period_end;
      if (typeof end === 'number') currentPeriodEnd = new Date(end * 1000).toISOString();
    } catch {
      // Subscription may have been deleted from Stripe
    }
  }

  return {
    plan:              row?.plan ?? 'basic',
    status:            row?.subscription_status ?? 'inactive',
    subscriptionId:    row?.stripe_subscription_id ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    pendingPlan:       row?.pending_plan ?? null,
    currentPeriodEnd,
  };
}

export async function cancelSubscription(userId: string): Promise<{ currentPeriodEnd: string | null }> {
  const row = await queryOne<{ stripe_subscription_id: string | null }>(
    'SELECT stripe_subscription_id FROM client_profiles WHERE user_id = $1',
    [userId],
  );
  if (!row?.stripe_subscription_id) {
    throw createError('No hay suscripción activa para cancelar.', 400);
  }

  const sub = await stripe.subscriptions.update(row.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  await query(
    'UPDATE client_profiles SET cancel_at_period_end = TRUE, updated_at = NOW() WHERE user_id = $1',
    [userId],
  );

  logger.info('Suscripción marcada para cancelar al fin del período', { userId, subscriptionId: row.stripe_subscription_id });

  const end = (sub as any).current_period_end;
  return { currentPeriodEnd: typeof end === 'number' ? new Date(end * 1000).toISOString() : null };
}

// Inline types to avoid Stripe namespace resolution issues with CommonJS
interface StripeCheckoutSession {
  id:                   string;
  client_reference_id:  string | null;
  metadata:             Record<string, string> | null;
  subscription:         string | null;
  payment_status:       string;
}
interface StripeSubscription {
  id:                    string;
  status:                string;
  metadata:              Record<string, string>;
  cancel_at_period_end:  boolean;
}
interface StripeInvoice {
  customer: string | null;
}

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: { object: any } };
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed', { error: err.message });
    throw new Error(`Stripe webhook signature failed: ${err.message}`);
  }

  logger.info('Stripe webhook received', { type: event.type });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as StripeCheckoutSession;
      const userId  = session.client_reference_id ?? session.metadata?.userId;
      const plan    = session.metadata?.plan;
      const subId   = session.subscription;

      if (!userId || !plan) {
        logger.warn('checkout.session.completed: missing metadata — plan NOT activated', { id: session.id, userId, plan });
        break;
      }
      if (session.payment_status !== 'paid') {
        logger.warn('checkout.session.completed: payment_status no es "paid" — plan NOT activated', {
          id: session.id, userId, plan, paymentStatus: session.payment_status,
        });
        break;
      }

      // Activación real del plan pagado — is_trial/delivery_mode se resetean
      // igual que antes lo hacía selectPlan(), solo que ahora gated en el
      // pago confirmado en vez de en la sola elección del plan.
      await query(
        `UPDATE client_profiles
         SET plan = $1, plan_selected_at = NOW(), is_trial = FALSE, delivery_mode = NULL,
             pending_plan = NULL, cancel_at_period_end = FALSE,
             stripe_subscription_id = $2, subscription_status = 'active', updated_at = NOW()
         WHERE user_id = $3`,
        [plan, subId, userId],
      );
      logger.info('Plan activado vía Stripe checkout confirmado', { userId, plan, subId, sessionId: session.id });
      break;
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as StripeSubscription;
      const userId = sub.metadata?.userId;
      // TEMP DEBUG: payload crudo para diagnosticar bug de cancel_at_period_end — remover tras confirmar
      logger.info('TEMP DEBUG customer.subscription.updated raw payload', {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        raw: event.data.object,
      });
      if (!userId) break;

      const status = sub.status === 'active'   ? 'active'
                   : sub.status === 'past_due'  ? 'past_due'
                   : sub.status === 'canceled'  ? 'cancelled'
                   : sub.status;

      await query(
        `UPDATE client_profiles
         SET subscription_status = $1, cancel_at_period_end = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [status, sub.cancel_at_period_end ?? false, userId],
      );
      const plan = sub.metadata?.plan;
      if (plan) await query('UPDATE client_profiles SET plan = $1 WHERE user_id = $2', [plan, userId]);
      logger.info('Suscripción actualizada', { userId, status, cancelAtPeriodEnd: sub.cancel_at_period_end });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as StripeSubscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      await query(
        `UPDATE client_profiles
         SET subscription_status = 'cancelled', stripe_subscription_id = NULL,
             cancel_at_period_end = FALSE, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
      logger.info('Suscripción cancelada (fin de período alcanzado)', { userId });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice    = event.data.object as StripeInvoice;
      const customerId = invoice.customer;
      if (!customerId) break;

      const userRow = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE stripe_customer_id = $1',
        [customerId],
      );
      if (!userRow) break;

      await query(
        `UPDATE client_profiles SET subscription_status = 'past_due', updated_at = NOW() WHERE user_id = $1`,
        [userRow.id],
      );
      logger.warn('Invoice payment failed', { customerId });
      break;
    }
  }
}
