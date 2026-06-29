'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clients } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const OPTIONS = [
  { key: 'automatic' as const, labelKey: 'delivery_mode_automatic', descKey: 'delivery_mode_automatic_desc' },
  { key: 'manual' as const, labelKey: 'delivery_mode_manual', descKey: 'delivery_mode_manual_desc' },
];

type DeliveryOption = typeof OPTIONS[number];

export default function DeliveryModePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedMode, setSelectedMode] = useState<'automatic' | 'manual' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!selectedMode) return;
    setSaving(true);
    setError(null);

    try {
      await clients.selectDeliveryMode(selectedMode);
      if (selectedMode === 'automatic') {
        router.replace('/connect');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-100">{t('delivery_mode_title')}</h1>
          <p className="mt-3 text-slate-400">{t('delivery_mode_sub')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedMode(option.key)}
              className={`rounded-3xl border p-6 text-left transition-all duration-200 text-left ${
                selectedMode === option.key
                  ? 'border-brand-500 bg-brand-600/10'
                  : 'border-white/10 bg-slate-900/80 hover:border-white/20 hover:bg-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-lg font-semibold text-slate-100">{t(option.labelKey)}</span>
                {selectedMode === option.key && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    {t('delivery_mode_active')}
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm text-slate-400">{t(option.descKey)}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={!selectedMode || saving}
            onClick={handleSave}
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {saving ? 'Guardando…' : t('delivery_mode_save')}
          </button>
          <p className="text-xs text-slate-500 sm:text-right">{t('delivery_mode_note')}</p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
