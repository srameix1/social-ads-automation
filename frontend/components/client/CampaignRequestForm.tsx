'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { campaigns as campaignsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { id: 'facebook',  label: 'Facebook',  icon: '👥' },
];

export function CampaignRequestForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    title:           '',
    objective:       '',
    target_audience: '',
    platforms:       [] as string[],
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const showError = (msg: string) => {
    // Always provide a fallback so the error div renders even if msg is empty
    const displayMsg = msg || 'Ha ocurrido un error inesperado. Revisa la consola del navegador.';
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(displayMsg);
    // Keep error visible for 8 seconds, then auto-clear
    errorTimerRef.current = setTimeout(() => setError(''), 8000);
  };

  const togglePlatform = (id: string) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(id)
        ? f.platforms.filter(p => p !== id)
        : [...f.platforms, id],
    }));
  };

  const submit = async () => {
    if (!form.title)            { showError(t('form_camp_err_title'));     return; }
    if (!form.objective)        { showError(t('form_camp_err_objective')); return; }
    if (!form.platforms.length) { showError(t('form_camp_err_platform')); return; }

    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setLoading(true);
    setError('');

    try {
      console.log('[Campaign] Enviando al backend:', form);
      const data = await campaignsApi.create(form);
      console.log('[Campaign] Respuesta del backend (raw):', data);
      console.log('[Campaign] Estado de la campaña:', data?.campaign?.status);
      console.log('[Campaign] Error de la campaña:', data?.campaign?.error_message);

      // If the backend created the campaign but Claude failed (status: 'failed'),
      // show the error on the form instead of navigating to a broken campaign page.
      if (data.campaign.status === 'failed') {
        const errMsg = data.campaign.error_message || t('form_camp_err_generate');
        console.error('[Campaign] Campaña creada con status=failed. Mensaje:', errMsg);
        showError(errMsg);
        setLoading(false);
        return;
      }

      // Keep loading=true during navigation so the button stays disabled
      console.log('[Campaign] Navegando a /campaigns/' + data.campaign.id);
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (err: unknown) {
      console.error('[Campaign] ===== ERROR AL CREAR CAMPAÑA =====');
      console.error('[Campaign] Tipo de error:', typeof err);
      console.error('[Campaign] Error completo:', err);
      console.error('[Campaign] Message:', err instanceof Error ? err.message : String(err));
      console.error('[Campaign] Stack:', err instanceof Error ? err.stack : 'N/A');
      console.error('[Campaign] =====================================');
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Input
        label={t('form_camp_title')}
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder={t('form_camp_title_ph')}
      />
      <Textarea
        label={t('form_camp_objective')}
        value={form.objective}
        onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
        placeholder={t('form_camp_objective_ph')}
        rows={3}
      />
      <Textarea
        label={t('form_camp_audience')}
        value={form.target_audience}
        onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
        placeholder={t('form_camp_audience_ph')}
        rows={3}
      />

      <div>
        <p className="text-xs font-medium text-slate-400 mb-2">{t('form_camp_platforms')}</p>
        <div className="flex gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlatform(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                form.platforms.includes(p.id)
                  ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                  : 'border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]'
              }`}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-brand-300 border border-brand-500/20 bg-brand-500/5 px-4 py-3 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          {t('form_camp_generating')}
        </div>
      )}

      <Button onClick={submit} loading={loading} type="button" className="w-full" size="lg">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        {t('form_camp_submit')}
      </Button>
    </div>
  );
}
