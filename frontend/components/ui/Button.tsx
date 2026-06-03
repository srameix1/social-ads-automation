import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?:    'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary:   'bg-brand-600 hover:bg-brand-500 text-white shadow-glow-sm focus:ring-brand-500/50',
  secondary: 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.1] focus:ring-white/20',
  outline:   'border border-brand-500/50 hover:border-brand-400 text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 focus:ring-brand-500/30',
  danger:    'bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500/50',
  ghost:     'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] focus:ring-white/10',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-sm rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
        transition-all duration-150 cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
