import { ReactNode } from 'react';

interface Props {
  children:   ReactNode;
  className?: string;
  padding?:   boolean;
  glow?:      boolean;
}

export function Card({ children, className = '', padding = true, glow = false }: Props) {
  return (
    <div className={`
      surface rounded-xl
      ${glow ? 'shadow-glow' : 'shadow-card'}
      ${padding ? 'p-6' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
