'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCampaign } from '@/hooks/useCampaigns';
import { campaigns as campaignsApi } from '@/lib/api';
import { campaignStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PublicationResult } from '@/components/client/PublicationResult';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';

const POLLING_STATUSES = ['generating', 'creating_media', 'publishing'];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { campaign, loading, refresh } = useCampaign(id);
  const { t, lang } = useLanguage();
  const [polling, setPolling]   = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await campaignsApi.retryPublishing(id);
      refresh();
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!campaign) return;
    if (POLLING_STATUSES.includes(campaign.status)) {
      setPolling(true);
      const interval = setInterval(refresh, 4000);
      return () => clearInterval(interval);
    } else {
      setPolling(false);
    }
  }, [campaign?.status, refresh]);

  if (loading) return <PageLoader />;
  if (!campaign) return (
    <div className="text-center py-20 text-slate-500">
      <p>{t('camp_not_found')}</p>
      <Link href="/campaigns" className="text-brand-400 text-sm mt-2 block">{t('camp_not_found_link')}</Link>
    </div>
  );

  const dateLocale = lang === 'es' ? 'es-MX' : 'en-US';

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {t('camp_back')}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              {campaignStatusBadge(campaign.status)}
              {polling && <Spinner size="sm" className="text-brand-400" />}
              <span className="text-xs text-slate-600">
                {new Date(campaign.created_at).toLocaleString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Processing states */}
      {campaign.status === 'generating' && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm text-blue-300">
          <Spinner size="sm" className="text-blue-400 flex-shrink-0" />
          {t('camp_generating')}
        </div>
      )}
      {campaign.status === 'creating_media' && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-sm text-violet-300">
          <Spinner size="sm" className="text-violet-400 flex-shrink-0" />
          {t('camp_media')}
        </div>
      )}
      {campaign.status === 'publishing' && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-sm text-indigo-300">
          <Spinner size="sm" className="text-indigo-400 flex-shrink-0" />
          {t('camp_publishing')}
        </div>
      )}
      {campaign.status === 'failed' && (() => {
        const isCredentialError =
          !campaign.error_message ||
          campaign.error_message.toLowerCase().includes('credencial');

        if (isCredentialError) {
          return (
            <div className="rounded-xl p-6 border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-amber-300 mb-1">{t('camp_no_creds_title')}</h3>
                  <p className="text-sm text-slate-400 mb-4">{t('camp_no_creds_sub')}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/profile">
                      <Button variant="outline" size="sm">{t('camp_no_creds_btn')}</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={retrying}
                      onClick={handleRetry}
                    >
                      {retrying ? t('camp_retrying') : t('camp_retry_btn')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-400">
            <span className="font-semibold">Error: </span>{campaign.error_message}
          </div>
        );
      })()}

      {/* Campaign details */}
      <div className="surface rounded-xl p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{t('camp_details')}</h2>
        <div className="grid grid-cols-2 gap-5 text-sm">
          <div>
            <p className="text-xs text-slate-600 mb-1">{t('camp_objective')}</p>
            <p className="text-slate-300">{campaign.objective || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">{t('camp_platforms')}</p>
            <p className="text-slate-300">{campaign.platforms.join(', ')}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-600 mb-1">{t('camp_audience')}</p>
            <p className="text-slate-300">{campaign.target_audience || '—'}</p>
          </div>
        </div>
      </div>

      {/* Strategy selection CTA */}
      {campaign.status === 'pending_selection' && campaign.strategies.length > 0 && (
        <div className="rounded-xl p-6 text-center border border-brand-500/20"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(124,58,237,0.08) 100%)' }}>
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">{t('camp_3_ready')}</h2>
          <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">{t('camp_3_sub')}</p>
          <Link href={`/campaigns/${id}/strategies`}>
            <Button size="lg">{t('camp_choose')}</Button>
          </Link>
        </div>
      )}

      {/* Publications */}
      {campaign.status === 'completed' && (
        <div>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-300 mb-5">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            {t('camp_published')}
          </div>
          <div className="surface rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{t('camp_publications')}</h2>
            <PublicationResult publications={campaign.publications} />
          </div>
        </div>
      )}
    </div>
  );
}
