'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BillingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to dashboard after 8 seconds
    const t = setTimeout(() => router.push('/dashboard'), 8000);
    return () => clearTimeout(t);
  }, [router]);

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
