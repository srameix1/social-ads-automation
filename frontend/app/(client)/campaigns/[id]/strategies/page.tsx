'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCampaign } from '@/hooks/useCampaigns';
import { campaigns as campaignsApi } from '@/lib/api';
import { StrategyCard } from '@/components/client/StrategyCard';
import { PageLoader } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StrategiesPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { t }   = useLanguage();
  const { campaign, loading } = useCampaign(id);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError]         = useState('');

  const handleSelect = async (strategyId: string) => {
    setSelecting(strategyId); setError('');
    try {
      await campaignsApi.selectStrategy(id, strategyId);
      router.push(`/campaigns/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setSelecting(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!campaign) return (
    <p className="text-center py-20 text-slate-500">{t('strat_not_found')}</p>
  );

  if (campaign.status !== 'pending_selection') {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <p className="text-slate-500">{t('strat_not_pending')}</p>
        <Link href={`/campaigns/${id}`} className="text-brand-400 text-sm mt-2 block">
          {t('strat_back_camp')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <Link href={`/campaigns/${id}`} className="text-sm text-slate-500 hover:text-slate-300 mb-1 block transition-colors">
          ← {campaign.title}
        </Link>
        <h1 className="text-2xl font-bold text-white">{t('strat_title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('strat_sub')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-sm text-rose-400 border border-rose-500/20 bg-rose-500/5 px-4 py-3 rounded-xl">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {campaign.strategies.map(s => (
          <StrategyCard
            key={s.id}
            strategy={s}
            position={s.position}
            onSelect={handleSelect}
            selecting={selecting === s.id}
          />
        ))}
      </div>
    </div>
  );
}
