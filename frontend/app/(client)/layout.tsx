'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/ui/Spinner';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';
import { clients, credentials } from '@/lib/api';

const ONBOARDING_EXEMPT = ['/select-plan', '/delivery-mode', '/connect'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router   = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (loading || !user || user.role !== 'client') return;
    if (ONBOARDING_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'))) return;

    let cancelled = false;
    (async () => {
      try {
        const { profile } = await clients.getProfile();
        if (cancelled) return;
        if (!profile.plan_selected_at) {
          router.replace('/select-plan');
          return;
        }
        if (!profile.delivery_mode) {
          router.replace('/delivery-mode');
          return;
        }
        if (profile.delivery_mode === 'automatic') {
          const { credentials: creds } = await credentials.list();
          if (cancelled) return;
          if (!creds.some(c => c.connected)) {
            router.replace('/connect');
          }
        }
      } catch { /* auth errors handled by api.ts */ }
    })();
    return () => { cancelled = true; };
  }, [loading, user, pathname, router]);

  const NAV = [
    {
      href: '/dashboard', label: t('nav_dashboard'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      ),
    },
    {
      href: '/campaigns', label: t('nav_campaigns'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
        </svg>
      ),
    },
    {
      href: '/profile', label: t('nav_profile'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      ),
    },
    {
      href: '/connect', label: t('nav_connect'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
      ),
    },
    {
      href: '/billing', label: t('nav_billing'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        </svg>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col fixed top-0 left-0 h-full z-20"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <SanaddsLogo size="sm" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}
              >
                <span className={active ? 'text-brand-400' : 'text-slate-600'}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* New campaign CTA */}
        <div className="px-3 pb-3">
          <Link
            href="/campaigns/new"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold
              bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500
              text-white transition-all duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            {t('nav_new_campaign')}
          </Link>
        </div>

        {/* Language toggle */}
        <div className="px-3 pb-3 flex justify-center">
          <LanguageToggle className="w-full justify-center" />
        </div>

        {/* User */}
        <div className="px-3 pb-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">{user?.email?.charAt(0).toUpperCase() ?? 'U'}</span>
            </div>
            <p className="text-xs text-slate-400 truncate flex-1">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            {t('nav_logout')}
          </button>
        </div>
      </aside>

      {/* Main content — offset for sidebar */}
      <main className="flex-1 ml-56 overflow-auto min-h-screen">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
