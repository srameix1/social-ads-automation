'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { billing } from '@/lib/api';
import { PLAN_DETAILS } from '@/lib/types';
import type { ServicePlan, SubscriptionStatus } from '@/lib/types';

const PLAN_ORDER: ServicePlan[] = ['basic', 'professional', 'premium'];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activo',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  inactive:  { label: 'Inactivo',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  past_due:  { label: 'Pago vencido', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  cancelled: { label: 'Cancelado', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [status, setStatus]     = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    billing.getStatus()
      .then(setStatus)
      .catch(err => setNotification({ type: 'error', message: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      setNotification({ type: 'error', message: 'Pago cancelado. Puedes intentarlo de nuevo cuando quieras.' });
      window.history.replaceState({}, '', '/billing');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(t);
  }, [notification]);

  async function subscribe(plan: ServicePlan) {
    setActionBusy(`checkout-${plan}`);
    try {
      const { url } = await billing.createCheckout(plan);
      window.location.href = url;
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
      setActionBusy(null);
    }
  }

  async function manageSubscription() {
    setActionBusy('portal');
    try {
      const { url } = await billing.createPortal();
      window.location.href = url;
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
      setActionBusy(null);
    }
  }

  async function handleCancelSubscription() {
    if (!window.confirm('¿Cancelar tu suscripción? Seguirás teniendo acceso hasta el fin del período que ya pagaste, y no se te volverá a cobrar.')) {
      return;
    }
    setActionBusy('cancel');
    try {
      const { currentPeriodEnd } = await billing.cancelSubscription();
      setStatus(prev => prev && { ...prev, cancelAtPeriodEnd: true, currentPeriodEnd: currentPeriodEnd ?? prev.currentPeriodEnd });
      setNotification({ type: 'success', message: 'Tu suscripción se cancelará al final del período actual.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionBusy(null);
    }
  }

  const isActive = status?.status === 'active';
  const currentPlan = status?.plan ?? 'basic';

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Suscripción</h1>
        <p className="text-slate-400 text-sm">Administra tu plan y método de pago.</p>
      </div>

      {notification && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Current status */}
      {!loading && status && (
        <div className="mb-8 p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Plan actual</p>
              <p className="text-lg font-bold text-white">{PLAN_DETAILS[currentPlan].name}</p>
              {status.currentPeriodEnd && !status.cancelAtPeriodEnd && (
                <p className="text-xs text-slate-500 mt-1">
                  Próxima renovación: {new Date(status.currentPeriodEnd).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {status.cancelAtPeriodEnd && (
                <p className="text-xs text-amber-400 mt-1">
                  Se cancelará{status.currentPeriodEnd ? ` el ${new Date(status.currentPeriodEnd).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''} — no se renovará.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {(() => {
                const s = STATUS_LABELS[status.status] ?? STATUS_LABELS.inactive;
                return (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}>
                    {s.label}
                  </span>
                );
              })()}
              {isActive && (
                <button
                  onClick={manageSubscription}
                  disabled={!!actionBusy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-600 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {actionBusy === 'portal' ? 'Redirigiendo…' : 'Gestionar suscripción'}
                </button>
              )}
              {isActive && !status.cancelAtPeriodEnd && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={!!actionBusy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {actionBusy === 'cancel' ? 'Cancelando…' : 'Cancelar suscripción'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map(plan => {
          const details   = PLAN_DETAILS[plan];
          const isCurrent = currentPlan === plan && isActive;
          const busy      = actionBusy === `checkout-${plan}`;

          return (
            <div
              key={plan}
              className={`flex flex-col p-5 rounded-xl border transition-all ${
                isCurrent
                  ? 'border-brand-500/50 bg-brand-500/5'
                  : 'hover:border-slate-600'
              }`}
              style={isCurrent ? {} : { background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">{details.name}</span>
                {plan === 'professional' && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/20">
                    Popular
                  </span>
                )}
                {isCurrent && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-500/20 text-brand-300 border border-brand-500/20">
                    Tu plan
                  </span>
                )}
              </div>

              <p className="text-2xl font-bold text-white mb-1">
                ${details.price}<span className="text-sm font-normal text-slate-400">/mes</span>
              </p>

              <ul className="flex-1 mt-3 space-y-2">
                {details.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                    <svg className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && subscribe(plan)}
                disabled={isCurrent || !!actionBusy || loading}
                className={`mt-5 w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                  isCurrent
                    ? 'bg-brand-600/20 text-brand-400 cursor-default'
                    : 'bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50'
                }`}
              >
                {isCurrent ? 'Plan actual'
                  : busy ? 'Redirigiendo…'
                  : isActive ? 'Cambiar a este plan'
                  : 'Suscribirse'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-600 text-center">
        Pagos procesados de forma segura por Stripe. Cancela en cualquier momento.
      </p>
    </div>
  );
}
