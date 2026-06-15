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

export default function CampaignsPage() {
  const { campaigns, loading } = useCampaigns();
  const { t, lang } = useLanguage();
  if (loading) return <PageLoader />;

  const dateLocale = LOCALE_MAP[lang];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('camp_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('camp_total', campaigns.length)}</p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            {t('camp_new')}
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="surface rounded-xl p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600/20 to-violet-600/20 border border-brand-500/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">{t('camp_empty_title')}</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">{t('camp_empty_sub')}</p>
          <Link href="/campaigns/new">
            <Button size="lg">{t('camp_empty_btn')}</Button>
          </Link>
        </div>
      ) : (
        <div className="surface rounded-xl overflow-hidden">
          {campaigns.map((c, idx) => {
            const postsUsed = c.posts_used ?? 0;
            const maxPosts  = c.max_posts  ?? 20;
            const pct       = Math.min((postsUsed / maxPosts) * 100, 100);
            const atLimit   = postsUsed >= maxPosts;

            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className={`flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                  idx !== 0 ? 'border-t border-white/[0.05]' : ''
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{c.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-600">
                        {new Date(c.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-slate-700">·</span>
                      <div className="flex gap-1">
                        {c.platforms.map(p => (
                          <span key={p} title={p} className="text-xs">{PLATFORM_ICONS[p] ?? p}</span>
                        ))}
                      </div>
                    </div>
                    {/* Posts progress */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-24 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${atLimit ? 'bg-rose-500' : 'bg-brand-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs ${atLimit ? 'text-rose-400' : 'text-slate-500'}`}>
                        {postsUsed}/{maxPosts} anuncios
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
