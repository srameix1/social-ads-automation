'use client';

import { useState, useRef } from 'react';
import { Button }          from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { clients }         from '@/lib/api';
import { ServicePlan }     from '@/lib/types';
import { PlanSelector }    from './PlanSelector';
import { BrandSetupForm }  from './BrandSetupForm';
import { useLanguage }     from '@/contexts/LanguageContext';
import Image               from 'next/image';

interface Props { onComplete: () => void }

type Step = 1 | 2 | 3 | 4 | 5;

export function ProfileSetupForm({ onComplete }: Props) {
  const { t } = useLanguage();
  const [step, setStep]         = useState<Step>(1);
  const [plan, setPlan]         = useState<ServicePlan | undefined>();
  const [businessName, setName] = useState('');
  const [description, setDesc]  = useState('');
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  const [files, setFiles]       = useState<(File | null)[]>([null, null, null]);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const hasBrandStep = plan === 'professional' || plan === 'premium';
  const steps: Step[] = hasBrandStep ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];

  const STEP_LABELS: Record<Step, string> = {
    1: t('step_plan'),
    2: t('step_business'),
    3: t('step_photos'),
    4: hasBrandStep ? t('step_brand') : t('step_done'),
    5: t('step_done'),
  };

  const handlePhoto = (index: number, file: File) => {
    const f = [...files]; const p = [...previews];
    f[index] = file;
    p[index] = URL.createObjectURL(file);
    setFiles(f); setPreviews(p);
  };

  const savePlan = async () => {
    if (!plan) { setError(t('step1_err')); return; }
    setLoading(true); setError('');
    try {
      await clients.selectPlan(plan);
      setStep(2);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  const saveProfile = async () => {
    if (!businessName.trim()) { setError(t('step2_err')); return; }
    setLoading(true); setError('');
    try {
      await clients.updateProfile({ business_name: businessName, description });
      setStep(3);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  const savePhotos = async () => {
    if (files.some(f => !f)) { setError(t('step3_err')); return; }
    setLoading(true); setError('');
    try {
      const form = new FormData();
      files.forEach((f, i) => { if (f) form.append(`photo_${i + 1}`, f); });
      await clients.uploadPhotos(form);
      setStep(hasBrandStep ? 4 : 5);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  const isCompleted = (step === 5) || (step === 4 && !hasBrandStep);

  return (
    <div>
      {/* Progress bar */}
      <div className="flex items-center gap-1.5 mb-8">
        {steps.map((n, idx) => {
          const done    = step > n;
          const current = step === n;
          return (
            <div key={n} className="flex items-center gap-1.5 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0 transition-all ${
                done    ? 'bg-brand-600 text-white' :
                current ? 'bg-brand-600/30 text-brand-300 border border-brand-500/50' :
                          'bg-white/[0.05] text-slate-600 border border-white/[0.08]'
              }`}>
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : n}
              </div>
              <span className={`text-xs hidden sm:block ${current ? 'text-slate-300' : done ? 'text-slate-500' : 'text-slate-700'}`}>
                {STEP_LABELS[n]}
              </span>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-px rounded ${done ? 'bg-brand-600/50' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Plan */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('step1_title')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('step1_sub')}</p>
          </div>
          <PlanSelector selected={plan} onSelect={p => { setPlan(p); setError(''); }} />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {plan && (
            <Button onClick={savePlan} loading={loading} className="w-full" size="lg">
              {t('step1_btn')}
            </Button>
          )}
        </div>
      )}

      {/* STEP 2: Business info */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('step2_title')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('step2_sub')}</p>
          </div>
          <Input
            label={t('step2_name')}
            value={businessName}
            onChange={e => setName(e.target.value)}
            placeholder={t('step2_name_ph')}
            required
          />
          <Textarea
            label={t('step2_desc')}
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder={t('step2_desc_ph')}
            hint={t('step2_desc_hint')}
            rows={5}
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button onClick={saveProfile} loading={loading} className="w-full" size="lg">
            {t('step2_btn')}
          </Button>
        </div>
      )}

      {/* STEP 3: Photos */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('step3_title')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('step3_sub')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                onClick={() => inputRefs[i].current?.click()}
                className={`aspect-square rounded-xl border-2 border-dashed cursor-pointer overflow-hidden
                  flex items-center justify-center transition-all group
                  ${previews[i]
                    ? 'border-brand-500/30'
                    : 'border-white/[0.08] hover:border-brand-500/40 bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
              >
                {previews[i] ? (
                  <Image src={previews[i]!} alt={t('step3_photo', i + 1)} width={200} height={200}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <svg className="w-8 h-8 text-slate-700 mx-auto mb-2 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <p className="text-xs text-slate-700">{t('step3_photo', i + 1)}</p>
                  </div>
                )}
                <input ref={inputRefs[i]} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handlePhoto(i, e.target.files[0])} />
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button onClick={savePhotos} loading={loading} className="w-full" size="lg">
            {loading ? t('step3_btn_upload') : t('step3_btn')}
          </Button>
        </div>
      )}

      {/* STEP 4: Brand (Professional/Premium only) */}
      {step === 4 && hasBrandStep && (
        <BrandSetupForm onComplete={() => setStep(5)} />
      )}

      {/* Done */}
      {isCompleted && (
        <div className="text-center space-y-5 py-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-brand-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{t('done_title')}</h2>
            <p className="text-slate-500 text-sm mt-1">{t('done_sub')}</p>
          </div>
          <Button onClick={onComplete} className="w-full" size="lg">
            {t('done_btn')}
          </Button>
        </div>
      )}
    </div>
  );
}
