'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-between mb-10">
          <SanaddsLogo size="md" />
          <LanguageToggle />
        </div>
        <h1 className="text-2xl font-bold text-white">{t('forgot_title')}</h1>
        <p className="text-slate-500 text-sm mt-1 mb-8">{t('forgot_sub')}</p>
        {sent ? (
          <p className="text-emerald-400 text-sm leading-relaxed">{t('forgot_sent')}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Input
              label={t('forgot_email')}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('auth_email_placeholder') as string}
              required
              autoFocus
            />
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {loading ? t('forgot_sending') : t('forgot_submit')}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            {t('forgot_back_login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
