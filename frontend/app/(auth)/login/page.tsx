'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { saveAuth, redirectByRole } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo, SanaddsHero } from '@/components/ui/Logo';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await auth.login(email, password);
      saveAuth(data.token, data.user);
      router.push(redirectByRole(data.user.role));
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0d0d1f 0%, #141428 60%, #1a1035 100%)' }}>

        {/* Ambient radial glow behind content */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(124,58,237,0.22) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col items-center text-center gap-10 max-w-sm w-full">
          {/* Hero logo — the star of the show */}
          <SanaddsHero />

          {/* Gradient rule */}
          <div className="w-20 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.45), transparent)' }} />

          {/* Tagline */}
          <div className="space-y-2.5">
            <h2 className="text-xl font-bold text-white leading-snug">{t('login_tagline')}</h2>
            <p className="text-slate-500 text-sm leading-relaxed">{t('login_tagline_sub')}</p>
          </div>

          {/* Feature pills */}
          <div className="space-y-2.5 w-full">
            {([
              { icon: '⚡', key: 'login_feature1' },
              { icon: '🎨', key: 'login_feature2' },
              { icon: '📱', key: 'login_feature3' },
            ] as const).map(item => (
              <div key={item.key}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-left"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-base">{item.icon}</span>
                <span className="text-slate-400 text-sm">{t(item.key)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-slate-700">{t('login_copyright')}</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo + lang toggle row */}
          <div className="flex items-center justify-between mb-10 lg:hidden">
            <SanaddsLogo size="md" />
            <LanguageToggle />
          </div>

          {/* Desktop lang toggle */}
          <div className="hidden lg:flex justify-end mb-6">
            <LanguageToggle />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">{t('login_welcome')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('login_subtitle')}</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Input
              label={t('login_email')}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />
            <Input
              label={t('login_password')}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {t('login_submit')}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {t('login_no_account')}{' '}
            <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t('login_register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
