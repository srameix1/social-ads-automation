'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { billing } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS       = 2 * 60 * 1000;

type Phase = 'polling' | 'active' | 'timeout';

export default function BillingSuccessPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>('polling');
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const status = await billing.getStatus();
        if (cancelled) return;

        if (status.status === 'active') {
          setPhase('active');
          return;
        }
      } catch {
        // Ignora errores transitorios de red — sigue intentando hasta el timeout.
      }

      if (Date.now() - startedAt.current >= TIMEOUT_MS) {
        if (!cancelled) setPhase('timeout');
        return;
      }

      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    const t = setTimeout(() => router.push('/dashboard'), 4000);
    return () => clearTimeout(t);
  }, [phase, router]);

  if (phase === 'polling') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">{t('billing_success_processing_title')}</h1>
        <p className="text-slate-400 text-sm mb-1">{t('billing_success_processing_sub')}</p>
        <p className="text-slate-600 text-xs">{t('billing_success_processing_hint')}</p>
      </div>
    );
  }

  if (phase === 'timeout') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('billing_success_timeout_title')}</h1>
        <p className="text-slate-400 text-sm mb-1 max-w-sm">
          {t('billing_success_timeout_sub')}
        </p>
        <p className="text-slate-600 text-xs mb-8">{t('billing_success_timeout_hint')}</p>

        <Link
          href="/billing"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
        >
          {t('billing_success_timeout_link')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">{t('billing_success_active_title')}</h1>
      <p className="text-slate-400 text-sm mb-1">{t('billing_success_active_sub')}</p>
      <p className="text-slate-600 text-xs mb-8">{t('billing_success_active_hint')}</p>

      <div className="flex gap-3">
        <Link
          href="/connect"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:bg-white/5 transition-colors"
        >
          {t('billing_success_connect_link')}
        </Link>
        <Link
          href="/campaigns/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
        >
          {t('dash_empty_btn')}
        </Link>
      </div>
    </div>
  );
}
