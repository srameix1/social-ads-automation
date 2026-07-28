'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { t }        = useLanguage();
  const [status,        setStatus]        = useState<Status>('loading');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [resendEmail,   setResendEmail]   = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent,    setResendSent]    = useState(false);
  const [resendError,   setResendError]   = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMsg(t('verify_email_error_sub') as string);
      return;
    }

    auth.verifyEmail(token)
      .then(data => {
        saveAuth(data.token, data.user);
        setStatus('success');
        setTimeout(() => {
          router.push(data.user.role === 'admin' ? '/admin' : '/dashboard');
        }, 1800);
      })
      .catch(err => {
        setStatus('error');
        setErrorMsg((err as Error).message || (t('verify_email_error_sub') as string));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendLoading(true); setResendError('');
    try {
      await auth.resendVerification(resendEmail.trim());
      setResendSent(true);
    } catch (err) {
      setResendError((err as Error).message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm animate-slide-up text-center">
        <div className="flex justify-center mb-10">
          <SanaddsLogo size="md" />
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <svg
                  className="w-10 h-10 text-brand-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
              <p className="text-slate-300 text-base">{t('verify_email_loading')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">{t('verify_email_success_title')}</h1>
              <p className="text-slate-400 text-sm">{t('verify_email_success_sub')}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">{t('verify_email_error_title')}</h1>
              <p className="text-slate-400 text-sm mb-6">{errorMsg || t('verify_email_error_sub')}</p>

              {!resendSent ? (
                <form onSubmit={handleResend} className="space-y-3 text-left">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    placeholder={t('resend_verification_email_ph') as string}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-600/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500/60"
                  />
                  {resendError && (
                    <p className="text-rose-400 text-xs">{resendError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {resendLoading ? t('resend_verification_sending') : t('resend_verification_btn')}
                  </button>
                </form>
              ) : (
                <p className="text-emerald-400 text-sm mb-4">
                  {t('resend_verification_sent')}
                </p>
              )}

              <Link
                href="/register"
                className="inline-block mt-4 text-slate-500 hover:text-slate-400 text-xs transition-colors"
              >
                {t('verify_email_go_register')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<div>{t('page_loading')}</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
