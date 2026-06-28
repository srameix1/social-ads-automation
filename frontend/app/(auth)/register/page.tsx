'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auth, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SanaddsLogo } from '@/components/ui/Logo';

export default function RegisterPage() {
  const { t } = useLanguage();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [sent,          setSent]          = useState(false);
  const [showResend,    setShowResend]    = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent,    setResendSent]    = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError(t('register_err_mismatch') as string); return; }
    if (password.length < 8)  { setError(t('register_err_short') as string);    return; }
    setLoading(true); setError(''); setShowResend(false); setResendSent(false);
    try {
      await auth.register(email, password);
      setSent(true);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'EMAIL_EXISTS_UNVERIFIED') setShowResend(true);
      setError(apiErr.message);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true); setError('');
    try {
      await auth.resendVerification(email);
      setResendSent(true);
      setShowResend(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResendLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm animate-slide-up text-center">
          <div className="flex justify-center mb-10">
            <SanaddsLogo size="md" />
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{t('register_check_email_title')}</h1>
            <p className="text-slate-400 text-sm leading-relaxed">{t('register_check_email_sub')}</p>
            <p className="text-slate-600 text-xs mt-4">{email}</p>
          </div>
          <p className="text-center text-sm text-slate-500 mt-6">
            {t('register_has_account')}{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t('register_login')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

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
            label={t('login_email') as string}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoFocus
          />
          <Input
            label={t('login_password') as string}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('register_password_placeholder') as string}
            required
          />
          <Input
            label={t('register_confirm') as string}
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={t('register_confirm_placeholder') as string}
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

          {showResend && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="w-full py-2.5 rounded-xl border border-brand-500/40 text-brand-400 hover:bg-brand-500/10 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {resendLoading ? t('resend_verification_sending') : t('resend_verification_btn')}
            </button>
          )}

          {resendSent && (
            <p className="text-emerald-400 text-sm text-center px-2">
              {t('resend_verification_sent')}
            </p>
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
