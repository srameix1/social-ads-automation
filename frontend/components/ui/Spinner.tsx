'use client';

import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' };

export function Spinner({ size = 'md', className = '' }: Props) {
  return (
    <svg
      className={`animate-spin ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PageLoader() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Spinner size="lg" className="text-brand-500" />
      <p className="text-sm text-slate-500">{t('page_loading')}</p>
    </div>
  );
}
