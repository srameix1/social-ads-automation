'use client';

import Link from 'next/link';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_MAP } from '@/lib/i18n';

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', facebook: '👥',
};

export default function DashboardPage() {
  const { campaigns, loading } = useCampaigns();
  const { t, lang } = useLanguage();

  if (loading) return <PageLoader />;

  const dateLocale = LOCALE_MAP[lang];

  // Count campaigns with in-progress posts
  const withActiveAds = campaigns.filter(c => (c.posts_used ?? 0) > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <p className="text-slate-500 text-sm mb-1">{t('dash_welcome')}</p>
        <h1 className="text-2xl font-bold text-white">{t('dash_title')}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="surface rounded-xl p-5">
          <p className="text-3xl font-bold text-white">{campaigns.length}</p>
          <p className="text-xs text-slate-500 mt-1.5 uppercase tracking-wider">{t('dash_total')}</p>
        </div>
        <div className="surface rounded-xl p-5 border-amber-500/20">
          <p className="text-3xl font-bold text-amber-400">
            {campaigns.reduce((sum, c) => sum + (c.posts_used ?? 0), 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 uppercase tracking-wider">{t('dash_ads_created')}</p>
        </div>
        <div className="surface rounded-xl p-5 border-emerald-500/20">
          <p className="text-3xl font-bold text-emerald-400">{withActiveAds.length}</p>
          <p className="text-xs text-slate-500 mt-1.5 uppercase tracking-wider">{t('dash_active_campaigns')}</p>
        </div>
      </div>

      {/* Campaigns list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{t('dash_recent')}</h2>
          <Link href="/campaigns" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            {t('dash_see_all')}
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="surface rounded-xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600/20 to-violet-600/20 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-200 mb-2">{t('dash_empty_title')}</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">{t('dash_empty_sub')}</p>
            <Link href="/campaigns/new">
              <Button size="lg">{t('dash_empty_btn')}</Button>
            </Link>
          </div>
        ) : (
          <div className="surface rounded-xl overflow-hidden">
            {campaigns.slice(0, 6).map((c, idx) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className={`flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                  idx !== 0 ? 'border-t border-white/[0.05]' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{c.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-600">
                        {new Date(c.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <span className="text-slate-700">·</span>
                      <div className="flex gap-1">
                        {c.platforms.map(p => (
                          <span key={p} title={p} className="text-xs">{PLATFORM_ICONS[p] ?? p}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{t('dash_ads_count', c.posts_used ?? 0, c.max_posts)}</span>
                  <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
