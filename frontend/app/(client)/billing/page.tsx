'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { billing } from '@/lib/api';
import { PLAN_DETAILS } from '@/lib/types';
import type { ServicePlan, SubscriptionStatus } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_MAP } from '@/lib/i18n';

const PLAN_ORDER: ServicePlan[] = ['basic', 'professional', 'premium'];

function useStatusLabels(t: (key: string, ...args: any[]) => string): Record<string, { label: string; color: string }> {
  return {
    active:    { label: t('billing_status_active'),    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    inactive:  { label: t('billing_status_inactive'),  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
    past_due:  { label: t('billing_status_past_due'),  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    cancelled: { label: t('billing_status_cancelled'), color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  };
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const STATUS_LABELS = useStatusLabels(t);
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
      setNotification({ type: 'error', message: t('billing_payment_cancelled_msg') });
      window.history.replaceState({}, '', '/billing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!window.confirm(t('billing_cancel_confirm'))) {
      return;
    }
    setActionBusy('cancel');
    try {
      const { currentPeriodEnd } = await billing.cancelSubscription();
      setStatus(prev => prev && { ...prev, cancelAtPeriodEnd: true, currentPeriodEnd: currentPeriodEnd ?? prev.currentPeriodEnd });
      setNotification({ type: 'success', message: t('billing_cancel_success_msg') });
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
        <h1 className="text-2xl font-bold text-white mb-1">{t('nav_billing')}</h1>
        <p className="text-slate-400 text-sm">{t('billing_sub')}</p>
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
              <p className="text-xs text-slate-500 mb-1">{t('billing_current_plan')}</p>
              <p className="text-lg font-bold text-white">{PLAN_DETAILS[currentPlan].name}</p>
              {status.currentPeriodEnd && !status.cancelAtPeriodEnd && (
                <p className="text-xs text-slate-500 mt-1">
                  {t('billing_next_renewal', new Date(status.currentPeriodEnd).toLocaleDateString(LOCALE_MAP[lang], { day: 'numeric', month: 'long', year: 'numeric' }))}
                </p>
              )}
              {status.cancelAtPeriodEnd && (
                <p className="text-xs text-amber-400 mt-1">
                  {t('billing_cancel_notice', status.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString(LOCALE_MAP[lang], { day: 'numeric', month: 'long', year: 'numeric' }) : undefined)}
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
                  {actionBusy === 'portal' ? t('connect_redirecting') : t('billing_manage_sub')}
                </button>
              )}
              {isActive && !status.cancelAtPeriodEnd && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={!!actionBusy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {actionBusy === 'cancel' ? t('billing_cancelling') : t('billing_cancel_sub')}
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
                    {t('billing_popular')}
                  </span>
                )}
                {isCurrent && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-500/20 text-brand-300 border border-brand-500/20">
                    {t('billing_your_plan')}
                  </span>
                )}
              </div>

              <p className="text-2xl font-bold text-white mb-1">
                ${details.price}<span className="text-sm font-normal text-slate-400">{t('plan_month')}</span>
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
                {isCurrent ? t('billing_current_plan')
                  : busy ? t('connect_redirecting')
                  : isActive ? t('billing_switch_plan')
                  : t('billing_subscribe')}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-600 text-center">
        {t('billing_footer_note')}
      </p>
    </div>
  );
}
