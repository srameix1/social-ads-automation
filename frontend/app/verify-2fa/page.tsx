'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth, ApiError } from '@/lib/api';
import { saveAuth, redirectByRole } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SanaddsLogo } from '@/components/ui/Logo';
import { useLanguage } from '@/contexts/LanguageContext';

function Verify2FAContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { t }         = useLanguage();
  const pendingToken  = searchParams.get('pendingToken') ?? '';

  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await auth.verifyLogin2FA(pendingToken, code.trim());
      saveAuth(data.token, data.user);
      router.push(redirectByRole(data.user.role));
      setLoading(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex justify-center mb-10">
          <SanaddsLogo size="md" />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-white mb-2">{t('verify2fa_title')}</h1>
            <p className="text-slate-400 text-sm">{t('verify2fa_subtitle')}</p>
          </div>

          {!pendingToken && (
            <p className="text-rose-400 text-sm text-center mb-2">
              {t('verify2fa_missing_token')}
            </p>
          )}

          {pendingToken && (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label={t('verify2fa_code_label')}
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={t('verify2fa_code_placeholder') as string}
                autoFocus
                autoComplete="one-time-code"
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
                {t('verify2fa_submit')}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t('verify2fa_back_to_login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Verify2FAPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<div>{t('page_loading')}</div>}>
      <Verify2FAContent />
    </Suspense>
  );
}
