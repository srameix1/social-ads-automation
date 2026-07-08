'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { billing } from '@/lib/api';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS       = 2 * 60 * 1000;

type Phase = 'polling' | 'active' | 'timeout';

export default function BillingSuccessPage() {
  const router = useRouter();
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
        <h1 className="text-2xl font-bold text-white mb-2">Procesando tu pago...</h1>
        <p className="text-slate-400 text-sm mb-1">Estamos confirmando tu pago con Stripe.</p>
        <p className="text-slate-600 text-xs">Esto normalmente toma unos segundos.</p>
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
        <h1 className="text-2xl font-bold text-white mb-2">Esto está tardando más de lo esperado</h1>
        <p className="text-slate-400 text-sm mb-1 max-w-sm">
          Tu pago puede estar confirmado igual — a veces Stripe tarda unos minutos en avisarnos.
        </p>
        <p className="text-slate-600 text-xs mb-8">Si ya pagaste, revisa el estado en Suscripción en unos minutos.</p>

        <Link
          href="/billing"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
        >
          Ir a Suscripción
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

      <h1 className="text-2xl font-bold text-white mb-2">Suscripción activada</h1>
      <p className="text-slate-400 text-sm mb-1">Tu plan ya está activo. Ahora puedes crear campañas.</p>
      <p className="text-slate-600 text-xs mb-8">Serás redirigido automáticamente al dashboard en unos segundos.</p>

      <div className="flex gap-3">
        <Link
          href="/connect"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:bg-white/5 transition-colors"
        >
          Conectar redes sociales
        </Link>
        <Link
          href="/campaigns/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
        >
          Crear primera campaña
        </Link>
      </div>
    </div>
  );
}
