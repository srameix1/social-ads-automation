'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${className}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {(['es', 'en', 'pt'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold tracking-wider transition-all duration-150 ${
            lang === l
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
