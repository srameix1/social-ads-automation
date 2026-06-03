'use client';

import { ServicePlan, PLAN_DETAILS } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  selected?: ServicePlan;
  onSelect:  (plan: ServicePlan) => void;
  loading?:  boolean;
}

const PLAN_ORDER: ServicePlan[] = ['basic', 'professional', 'premium'];

const PLAN_STYLES: Record<ServicePlan, {
  border: string; bg: string; selectedBorder: string;
  priceColor: string; badge?: string; badgeKey?: string;
}> = {
  basic: {
    border: 'border-white/[0.07]',
    selectedBorder: 'border-slate-400/50',
    bg: 'bg-white/[0.02]',
    priceColor: 'text-slate-200',
  },
  professional: {
    border: 'border-brand-500/20',
    selectedBorder: 'border-brand-500/60',
    bg: 'bg-brand-500/5',
    priceColor: 'text-brand-300',
    badge: 'bg-brand-500/20 text-brand-300 border border-brand-500/30',
    badgeKey: 'plan_popular',
  },
  premium: {
    border: 'border-violet-500/20',
    selectedBorder: 'border-violet-500/60',
    bg: 'bg-violet-500/5',
    priceColor: 'text-violet-300',
    badge: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
    badgeKey: 'plan_all_in',
  },
};

export function PlanSelector({ selected, onSelect }: Props) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PLAN_ORDER.map(plan => {
        const detail   = PLAN_DETAILS[plan];
        const styles   = PLAN_STYLES[plan];
        const isActive = selected === plan;

        return (
          <button
            key={plan}
            onClick={() => onSelect(plan)}
            className={`rounded-xl border p-5 text-left transition-all duration-150 relative
              ${isActive
                ? `${styles.selectedBorder} ${styles.bg} ring-1 ring-inset ${styles.selectedBorder}`
                : `${styles.border} hover:border-white/[0.15] bg-white/[0.02]`
              }`}
          >
            {/* Selected indicator */}
            {isActive && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
            )}

            {/* Badge */}
            {styles.badge && styles.badgeKey && (
              <span className={`inline-block mb-3 px-2 py-0.5 text-xs font-semibold rounded-md ${styles.badge}`}>
                {t(styles.badgeKey)}
              </span>
            )}

            {/* Name & price */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">{detail.name}</h3>
              <p className={`text-2xl font-bold ${styles.priceColor}`}>
                ${detail.price}
                <span className="text-sm font-normal text-slate-600">{t('plan_month')}</span>
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-4">
              {detail.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                  <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            {/* Platforms */}
            <div className="flex flex-wrap gap-1">
              {detail.platforms.map(p => (
                <span key={p} className="px-2 py-0.5 text-xs rounded-md bg-white/[0.06] text-slate-500 border border-white/[0.06]">
                  {p}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
