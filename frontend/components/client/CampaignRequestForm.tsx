'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { campaigns as campaignsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_MAP } from '@/lib/i18n';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { id: 'facebook',  label: 'Facebook',  icon: '👥' },
];

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value: string, locale: string): string {
  const [year, month] = value.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function buildMonthOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
}

export function CampaignRequestForm() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const locale = LOCALE_MAP[lang];

  // Step 1: campaign basics
  const [step,      setStep]      = useState<1 | 2>(1);
  const [title,     setTitle]     = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [monthYear, setMonthYear] = useState(currentMonthYear());

  // Step 2: business profile
  const [businessProblem, setBusinessProblem] = useState('');
  const [differentiator,  setDifferentiator]  = useState('');
  const [idealClient,     setIdealClient]     = useState('');
  const [concreteResult,  setConcreteResult]  = useState('');
  const [clientPain,      setClientPain]      = useState('');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    );
  };

  const handleNextStep = () => {
    if (!title.trim())     { setError(t('form_camp_err_name'));     return; }
    if (!platforms.length) { setError(t('form_camp_err_platform2')); return; }
    setError('');
    setStep(2);
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await campaignsApi.create({
        title:            title.trim(),
        platforms,
        month_year:       monthYear,
        lang,
        business_problem: businessProblem.trim() || undefined,
        differentiator:   differentiator.trim()  || undefined,
        ideal_client:     idealClient.trim()     || undefined,
        concrete_result:  concreteResult.trim()  || undefined,
        client_pain:      clientPain.trim()       || undefined,
      });
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const monthOptions = buildMonthOptions();

  return (
    <div className="space-y-6">

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {[1, 2].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
              n < step  ? 'bg-brand-500 border-brand-500 text-white' :
              n === step ? 'border-brand-500 text-brand-400' :
                           'border-white/[0.1] text-slate-600'
            }`}>
              {n < step ? '✓' : n}
            </div>
            <span className={`text-xs ${n === step ? 'text-slate-300' : 'text-slate-600'}`}>
              {n === 1 ? t('form_step_campaign') : t('form_step_business')}
            </span>
            {n < 2 && <div className={`h-px w-8 ${n < step ? 'bg-brand-500' : 'bg-white/[0.08]'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Campaign basics ────────────────────────────────────── */}
      {step === 1 && (
        <>
          <Input
            label={t('form_camp_name_label')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('form_camp_name_ph')}
          />

          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">{t('form_camp_platforms_label')}</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    platforms.includes(p.id)
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                      : 'border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]'
                  }`}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">{t('form_camp_month_label')}</p>
            <div className="flex gap-2 flex-wrap">
              {monthOptions.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonthYear(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border capitalize ${
                    monthYear === m
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                      : 'border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]'
                  }`}
                >
                  {monthLabel(m, locale)}
                </button>
              ))}
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex justify-end">
            <Button onClick={handleNextStep} size="lg">
              {t('form_camp_next')}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 2: Business profile ───────────────────────────────────── */}
      {step === 2 && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">{t('form_biz_title')}</h3>
            <p className="text-xs text-slate-500">{t('form_biz_sub')}</p>
          </div>

          <Textarea
            label={t('form_biz_problem')}
            value={businessProblem}
            onChange={e => setBusinessProblem(e.target.value)}
            placeholder={t('form_biz_problem_ph')}
            rows={3}
          />
          <Textarea
            label={t('form_biz_diff')}
            value={differentiator}
            onChange={e => setDifferentiator(e.target.value)}
            placeholder={t('form_biz_diff_ph')}
            rows={3}
          />
          <Textarea
            label={t('form_biz_ideal')}
            value={idealClient}
            onChange={e => setIdealClient(e.target.value)}
            placeholder={t('form_biz_ideal_ph')}
            rows={2}
          />
          <Textarea
            label={t('form_biz_result')}
            value={concreteResult}
            onChange={e => setConcreteResult(e.target.value)}
            placeholder={t('form_biz_result_ph')}
            rows={2}
          />
          <Textarea
            label={t('form_biz_pain')}
            value={clientPain}
            onChange={e => setClientPain(e.target.value)}
            placeholder={t('form_biz_pain_ph')}
            rows={3}
          />

          {error && <ErrorBanner message={error} />}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              {t('form_camp_prev')}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
              >
                {t('form_camp_skip')}
              </button>
              <Button onClick={submit} loading={loading} size="lg">
                {t('form_camp_create')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      <span>{message}</span>
    </div>
  );
}
