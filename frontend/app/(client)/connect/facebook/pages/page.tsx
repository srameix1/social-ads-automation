'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { oauth } from '@/lib/api';

export default function FacebookPageSelectorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token  = searchParams.get('token') ?? '';

  const [pages, setPages]       = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading]   = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Token de selección inválido o expirado.'); setLoading(false); return; }
    oauth.getFacebookPages(token)
      .then(({ pages }) => setPages(pages))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function selectPage(pageId: string) {
    setSelecting(pageId);
    try {
      await oauth.selectFacebookPage(token, pageId);
      router.push('/connect?connected=facebook');
    } catch (err: any) {
      setError(err.message);
      setSelecting(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Selecciona tu Página de Facebook</h1>
        <p className="text-slate-400 text-sm">
          Encontramos múltiples Páginas en tu cuenta. Elige cuál deseas usar para publicar.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button
            onClick={() => router.push('/connect')}
            className="block mt-2 text-xs text-red-300 hover:text-red-200 underline"
          >
            Volver a intentar
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      )}

      {!loading && !error && pages.length === 0 && (
        <p className="text-slate-500 text-sm">No se encontraron páginas pendientes. Vuelve a intentar la conexión.</p>
      )}

      <div className="space-y-3">
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => selectPage(page.id)}
            disabled={!!selecting}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all
              hover:border-brand-500/50 hover:bg-brand-500/5 disabled:opacity-60"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{page.name}</p>
              <p className="text-xs text-slate-500">ID: {page.id}</p>
            </div>
            {selecting === page.id ? (
              <svg className="w-4 h-4 text-brand-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
