'use client';

import { VisualVariation } from '@/lib/types';
import { Button }          from '@/components/ui/Button';
import { useLanguage }     from '@/contexts/LanguageContext';

const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

interface Props {
  variation:  VisualVariation;
  onSelect:   (id: string) => void;
  selecting:  boolean;
}

export function VisualVariationCard({ variation, onSelect, selecting }: Props) {
  const { t } = useLanguage();

  const imageUrl = variation.url ? `${BACKEND_BASE}${variation.url}` : null;
  const isReady  = variation.status === 'ready' && !!imageUrl;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden flex flex-col transition-all duration-150 hover:scale-[1.01] hover:border-white/[0.15]">

      {/* Image / loading placeholder */}
      <div className="w-full aspect-square overflow-hidden bg-white/[0.04]">
        {isReady ? (
          <img
            src={imageUrl!}
            alt={t('visual_option_alt', variation.position)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-4">
            {variation.status === 'generating' ? (
              <>
                <div className="w-8 h-8 rounded-full border-2 border-brand-500/40 border-t-brand-400 animate-spin" />
                <p className="text-xs text-slate-500">{t('visual_generating')}</p>
              </>
            ) : (
              <p className="text-xs text-rose-400">{t('visual_failed')}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {t('visual_option')} {variation.position}
        </span>
        <Button
          onClick={() => onSelect(variation.id)}
          loading={selecting}
          disabled={!isReady || selecting}
          variant="primary"
          size="sm"
        >
          {t('visual_choose')}
        </Button>
      </div>

    </div>
  );
}
