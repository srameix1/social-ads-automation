'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';

function ResetForm() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError(t('reset_mismatch')); return; }
    if (password.length < 8) { setError(t('reset_short')); return; }
    setLoading(true); setError('');
    try {
      await auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <p className="text-rose-400 text-sm leading-relaxed">{t('reset_no_token')}</p>;
  }

  if (done) {
    return (
      <div>
        <p className="text-emerald-400 text-sm leading-relaxed">{t('reset_success')}</p>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            {t('forgot_back_login')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label={t('reset_password')}
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoFocus
      />
      <Input
        label={t('reset_confirm')}
        type="password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        placeholder="••••••••"
        required
      />
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      <Button type="submit" loading={loading} className="w-full" size="lg">
        {loading ? t('reset_saving') : t('reset_submit')}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-between mb-10">
          <SanaddsLogo size="md" />
          <LanguageToggle />
        </div>
        <h1 className="text-2xl font-bold text-white">{t('reset_title')}</h1>
        <p className="text-slate-500 text-sm mt-1 mb-8">{t('reset_sub')}</p>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
