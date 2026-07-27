'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
  hint?:    string;
}

const baseInput = `
  w-full rounded-lg px-3 py-2.5 text-sm text-slate-100
  bg-dark-700 border border-white/[0.08]
  placeholder-slate-600
  focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/40
  transition-colors duration-150
  disabled:opacity-40 disabled:cursor-not-allowed
`;

function EyeOpen() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
    </svg>
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', type, ...props },
  ref,
) {
  const { t } = useLanguage();
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && showPwd ? 'text' : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          type={resolvedType}
          className={`
            ${baseInput}
            ${isPassword ? 'pr-10' : ''}
            ${error ? 'border-rose-500/50 focus:border-rose-500/70 focus:ring-rose-500/30' : ''}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
            aria-label={showPwd ? t('input_hide_password') : t('input_show_password')}
          >
            {showPwd ? <EyeOff /> : <EyeOpen />}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?:  string;
}

export function Textarea({ label, error, hint, className = '', ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        rows={4}
        className={`${baseInput} resize-none ${error ? 'border-rose-500/50' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
