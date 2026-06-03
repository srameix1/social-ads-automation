'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError(t('register_err_mismatch')); return; }
    if (password.length < 8)  { setError(t('register_err_short'));    return; }
    setLoading(true); setError('');
    try {
      const data = await auth.register(email, password);
      saveAuth(data.token, data.user);
      router.push('/profile/setup');
    } catch (err) {
      setError((err as Error).message);
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

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">{t('register_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('register_subtitle')}</p>
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
            placeholder={t('register_password_placeholder')}
            required
          />
          <Input
            label={t('register_confirm')}
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={t('register_confirm_placeholder')}
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
            {t('register_submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          {t('register_has_account')}{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            {t('register_login')}
          </Link>
        </p>

        <p className="text-center text-xs text-slate-700 mt-8">
          {t('register_tos')}
        </p>
      </div>
    </div>
  );
}
