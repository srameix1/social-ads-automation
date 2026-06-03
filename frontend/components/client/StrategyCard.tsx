'use client';

import { Strategy } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  strategy:  Strategy;
  position:  1 | 2 | 3;
  onSelect:  (id: string) => void;
  selecting: boolean;
}

const OPTION_KEYS = {
  1: 'strat_option_a',
  2: 'strat_option_b',
  3: 'strat_option_c',
} as const;

const STYLES = {
  1: { border: 'border-brand-500/25',   bg: 'bg-brand-500/5',   accent: 'text-brand-300'   },
  2: { border: 'border-violet-500/25',  bg: 'bg-violet-500/5',  accent: 'text-violet-300'  },
  3: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/5', accent: 'text-emerald-300' },
};

export function StrategyCard({ strategy, position, onSelect, selecting }: Props) {
  const { t } = useLanguage();
  const styles = STYLES[position];

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-5 flex flex-col transition-all duration-150 hover:scale-[1.01]`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`text-xs font-bold uppercase tracking-widest ${styles.accent}`}>
            {t(OPTION_KEYS[position])}
          </span>
          <h3 className="text-base font-bold text-white mt-0.5 leading-snug">{strategy.title}</h3>
        </div>
        {strategy.tone && (
          <Badge variant="indigo">{strategy.tone}</Badge>
        )}
      </div>

      <p className="text-sm text-slate-400 mb-4 leading-relaxed">{strategy.description}</p>

      {strategy.target_hook && (
        <div className="rounded-lg px-4 py-3 mb-4 bg-white/[0.04] border border-white/[0.07]">
          <p className={`text-xs font-semibold mb-1 ${styles.accent}`}>{t('strat_hook')}</p>
          <p className="text-sm font-medium text-slate-300 italic">"{strategy.target_hook}"</p>
        </div>
      )}

      {strategy.copy_text && (
        <div className="mb-4">
          <p className={`text-xs font-semibold mb-1 ${styles.accent}`}>{t('strat_copy')}</p>
          <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{strategy.copy_text}</p>
        </div>
      )}

      {strategy.visual_concept && (
        <div className="mb-5">
          <p className={`text-xs font-semibold mb-1 ${styles.accent}`}>{t('strat_visual')}</p>
          <p className="text-sm text-slate-500">{strategy.visual_concept}</p>
        </div>
      )}

      <div className="mt-auto">
        <Button
          onClick={() => onSelect(strategy.id)}
          loading={selecting}
          className="w-full"
          variant="primary"
        >
          {selecting ? t('strat_selecting') : t('strat_select')}
        </Button>
      </div>
    </div>
  );
}
