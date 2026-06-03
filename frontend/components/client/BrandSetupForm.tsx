'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { clients } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';

interface Props { onComplete: () => void }

export function BrandSetupForm({ onComplete }: Props) {
  const { t } = useLanguage();
  const [primaryColor,   setPrimary]   = useState('#6366f1');
  const [secondaryColor, setSecondary] = useState('#818cf8');
  const [logoPreview,    setLogoPreview] = useState<string | null>(null);
  const [logoFile,       setLogoFile]    = useState<File | null>(null);
  const [loading,        setLoading]     = useState(false);
  const [error,          setError]       = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogo = (file: File) => {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setLoading(true); setError('');
    try {
      await clients.updateBrand({ brand_primary_color: primaryColor, brand_secondary_color: secondaryColor });
      if (logoFile) {
        const form = new FormData();
        form.append('logo', logoFile);
        await clients.uploadBrandLogo(form);
      }
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{t('brand_title')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('brand_sub')}</p>
      </div>

      {/* Logo upload */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2">{t('brand_logo')}</p>
        <div
          onClick={() => logoInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
            ${logoPreview
              ? 'border-brand-500/30 bg-brand-500/5'
              : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'
            }`}
        >
          {logoPreview ? (
            <div className="flex justify-center">
              <Image src={logoPreview} alt="Logo" width={120} height={120}
                className="max-h-28 object-contain" />
            </div>
          ) : (
            <div>
              <svg className="w-10 h-10 text-slate-700 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
              </svg>
              <p className="text-sm text-slate-500">{t('brand_logo_click')}</p>
              <p className="text-xs text-slate-600 mt-1">{t('brand_logo_hint')}</p>
            </div>
          )}
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleLogo(e.target.files[0])} />
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">{t('brand_primary')}</p>
          <div className="flex items-center gap-2">
            <input type="color" value={primaryColor} onChange={e => setPrimary(e.target.value)}
              className="h-9 w-12 rounded-lg cursor-pointer border-0 bg-transparent" />
            <Input value={primaryColor} onChange={e => setPrimary(e.target.value)}
              placeholder="#6366f1" className="flex-1 font-mono text-xs" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">{t('brand_secondary')}</p>
          <div className="flex items-center gap-2">
            <input type="color" value={secondaryColor} onChange={e => setSecondary(e.target.value)}
              className="h-9 w-12 rounded-lg cursor-pointer border-0 bg-transparent" />
            <Input value={secondaryColor} onChange={e => setSecondary(e.target.value)}
              placeholder="#818cf8" className="flex-1 font-mono text-xs" />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-white/[0.07]">
        <div className="h-12 w-full" style={{ backgroundColor: primaryColor }} />
        <div className="h-3 w-full" style={{ backgroundColor: secondaryColor }} />
        <p className="text-xs text-slate-700 text-center py-2 bg-dark-800">{t('brand_preview')}</p>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onComplete} className="flex-1 text-slate-500">
          {t('brand_skip')}
        </Button>
        <Button onClick={save} loading={loading} className="flex-1">
          {t('brand_save')}
        </Button>
      </div>
    </div>
  );
}
