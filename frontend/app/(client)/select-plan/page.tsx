'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { billing, clients } from '@/lib/api';
import { PLAN_DETAILS, type ServicePlan } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

const PLAN_ORDER: ServicePlan[] = ['basic', 'professional', 'premium'];

export default function SelectPlanPage() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const trialEnded = searchParams.get('trial_ended') === '1';
  const [pending, setPending] = useState<ServicePlan | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleChoose(plan: ServicePlan) {
    if (pending) return;
    setPending(plan);
    setError(null);
    try {
      // Persiste la elección primero (satisface el gate de onboarding) y
      // recién después manda a Stripe Checkout a cobrar.
      await clients.choosePlan(plan);
      const { url } = await billing.createCheckout(plan);
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          {trialEnded ? t('select_plan_title_trial_ended') : t('select_plan_title')}
        </h1>
        <p className="text-slate-400 text-sm">
          {trialEnded
            ? t('select_plan_sub_trial_ended')
            : t('select_plan_sub')}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {PLAN_ORDER.map(planKey => {
          const plan         = PLAN_DETAILS[planKey];
          const isPro        = planKey === 'professional';
          const isPremium    = planKey === 'premium';
          const isActive     = pending === planKey;

          return (
            <div
              key={planKey}
              onClick={() => handleChoose(planKey)}
              className={[
                'relative rounded-2xl p-6 border transition-all duration-200 cursor-pointer select-none',
                isActive
                  ? 'border-brand-500 ring-1 ring-brand-500/40 bg-brand-600/10'
                  : isPro
                    ? 'border-brand-500/40 bg-gradient-to-b from-brand-600/5 to-transparent hover:border-brand-500/70 hover:bg-brand-600/8'
                    : 'border-white/10 hover:border-white/20',
              ].join(' ')}
              style={!isActive && !isPro ? { background: 'var(--surface)' } : undefined}
            >
              {/* Popular badge */}
              {isPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold bg-brand-600 text-white whitespace-nowrap">
                  {t('plan_popular')}
                </span>
              )}

              {/* Plan name + price */}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {plan.name}
                </p>
                <p className="text-4xl font-bold text-slate-100">
                  ${plan.price}
                  <span className="text-sm font-normal text-slate-500 ml-1">{t('plan_month')}</span>
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Platform badges */}
              <div className="flex gap-1.5 mb-6">
                {plan.platforms.map(p => (
                  <span key={p} className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-slate-400 border border-white/10 capitalize">
                    {p}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <button
                disabled={!!pending}
                className={[
                  'w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-brand-600/60 text-white/70 cursor-wait'
                    : 'bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white',
                  pending && !isActive ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {isActive ? t('strat_selecting') : t('select_plan_cta')}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
