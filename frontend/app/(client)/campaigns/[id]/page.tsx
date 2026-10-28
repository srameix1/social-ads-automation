'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCampaign } from '@/hooks/useCampaigns';
import { campaigns as campaignsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PostsList } from '@/components/client/PostsList';
import { PageLoader } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_MAP } from '@/lib/i18n';
import type { Publication } from '@/lib/types';

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', facebook: '👥',
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { campaign, loading } = useCampaign(id);
  const { lang, t } = useLanguage();

  // Una sola carga a nivel de campaña — PostsList agrupa client-side por post,
  // no hace falta pedir publications por cada post individual.
  const [publications, setPublications] = useState<Publication[]>([]);
  useEffect(() => {
    campaignsApi.getPublications(id)
      .then(d => setPublications(d.publications))
      .catch(() => setPublications([])); // sin publicaciones todavía no es un error
  }, [id]);

  // Analítica básica: se lee bajo demanda y se cachea 6h en el backend.
  const [insights, setInsights] = useState<import('@/lib/types').CampaignInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsRefreshing, setInsightsRefreshing] = useState(false);
  const loadInsights = async (refresh = false) => {
    if (refresh) setInsightsRefreshing(true); else setInsightsLoading(true);
    try {
      setInsights(await campaignsApi.getInsights(id, refresh));
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false); setInsightsRefreshing(false);
    }
  };
  useEffect(() => { loadInsights(false); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageLoader />;
  if (!campaign) return (
    <div className="text-center py-20 text-slate-500">
      <p>{t('camp_not_found')}</p>
      <Link href="/campaigns" className="text-brand-400 text-sm mt-2 block">{t('camp_not_found_back')}</Link>
    </div>
  );

  const dateLocale  = LOCALE_MAP[lang];
  const postsUsed   = campaign.posts_used ?? 0;
  const maxPosts    = campaign.max_posts  ?? 20;
  const atLimit     = postsUsed >= maxPosts;
  const pct         = Math.min((postsUsed / maxPosts) * 100, 100);

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
        <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {campaign.month_year && (
            <span className="text-xs text-slate-500 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md capitalize">
              {new Date(campaign.month_year + '-01').toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
            </span>
          )}
          <div className="flex items-center gap-1">
            {campaign.platforms.map(p => (
              <span key={p} title={p} className="text-base">{PLATFORM_ICONS[p] ?? p}</span>
            ))}
          </div>
          <span className="text-xs text-slate-600">
            {new Date(campaign.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Posts section */}
      <div className="surface rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{t('camp_posts_month_title')}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-28 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${atLimit ? 'bg-rose-500' : 'bg-brand-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs ${atLimit ? 'text-rose-400' : 'text-slate-500'}`}>
                {t('dash_ads_count', postsUsed, maxPosts)}
              </span>
            </div>
          </div>
          <Link href={atLimit ? '#' : `/campaigns/${id}/posts/new`}>
            <Button
              size="sm"
              disabled={atLimit}
              title={atLimit ? t('camp_posts_limit_reached', maxPosts) : undefined}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              {t('camp_add_post')}
            </Button>
          </Link>
        </div>
        <PostsList posts={campaign.posts ?? []} campaignId={id} publications={publications} />
      </div>

      {/* Resultados — solo publicaciones ya publicadas, sin promesas. */}
      <div className="surface rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{t('insights_title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('insights_sub')}</p>
          </div>
          <Button size="sm" disabled={insightsRefreshing} onClick={() => loadInsights(true)}>
            {insightsRefreshing ? t('insights_refreshing') : t('insights_refresh')}
          </Button>
        </div>
        {insightsLoading ? (
          <p className="px-5 py-6 text-sm text-slate-500">…</p>
        ) : !insights || insights.insights.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">{t('insights_empty')}</p>
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4">
              {([
                { label: t('insights_reach'), value: insights.totals.reach },
                { label: t('insights_likes'), value: insights.totals.likes },
                { label: t('insights_comments'), value: insights.totals.comments },
                { label: t('insights_shares'), value: insights.totals.shares },
              ]).map(stat => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06]">
              {insights.insights.map(item => (
                <div key={item.publication_id} className="px-5 py-4 border-b border-white/[0.05] last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-200 capitalize">
                      {PLATFORM_ICONS[item.platform] ?? ''} {item.platform}
                    </span>
                    {item.post_url && (
                      <a href={item.post_url} target="_blank" rel="noreferrer" className="text-brand-400 text-xs">
                        {t('insights_view_post')}
                      </a>
                    )}
                  </div>
                  {item.status === 'available' ? (
                    <p className="text-xs text-slate-500 mt-1.5">
                      {t('insights_reach')}: {item.reach ?? '—'} · {t('insights_likes')}: {item.likes ?? '—'} · {t('insights_comments')}: {item.comments ?? '—'} · {t('insights_shares')}: {item.shares ?? '—'}
                    </p>
                  ) : (
                    <div className="mt-1.5">
                      <p className="text-xs text-amber-300">
                        {item.status === 'not_connected' ? t('insights_not_connected') : t('insights_not_available')}
                      </p>
                      {item.unavailable_reason && (
                        <p className="text-xs text-slate-500 mt-1">{item.unavailable_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
