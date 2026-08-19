'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { auth, twoFactor } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';

type SetupStep = 'scan' | 'backupCodes';

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading,     setLoading]     = useState(true);

  // ── Setup (activation) ─────────────────────────────────────────────────
  const [setupOpen,    setSetupOpen]    = useState(false);
  const [setupStep,    setSetupStep]    = useState<SetupStep>('scan');
  const [secret,       setSecret]       = useState('');
  const [otpauthUrl,   setOtpauthUrl]   = useState('');
  const [setupCode,    setSetupCode]    = useState('');
  const [backupCodes,  setBackupCodes]  = useState<string[]>([]);
  const [setupBusy,    setSetupBusy]    = useState(false);
  const [setupError,   setSetupError]   = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  // ── Disable ─────────────────────────────────────────────────────────────
  const [disableOpen,     setDisableOpen]     = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode,     setDisableCode]     = useState('');
  const [disableBusy,     setDisableBusy]     = useState(false);
  const [disableError,    setDisableError]    = useState('');

  useEffect(() => {
    auth.me()
      .then(d => setTotpEnabled(d.user.totp_enabled))
      .finally(() => setLoading(false));
  }, []);

  const openSetup = async () => {
    setSetupStep('scan'); setSetupCode(''); setSetupError(''); setBackupCodes([]);
    setSecretCopied(false);
    setSetupOpen(true);
    setSetupBusy(true);
    try {
      const { secret, otpauthUrl } = await twoFactor.setup();
      setSecret(secret);
      setOtpauthUrl(otpauthUrl);
    } catch (err) {
      setSetupError((err as Error).message);
    } finally {
      setSetupBusy(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupBusy(true); setSetupError('');
    try {
      const { backupCodes } = await twoFactor.verifySetup(setupCode.trim());
      setBackupCodes(backupCodes);
      setSetupStep('backupCodes');
      setTotpEnabled(true);
    } catch (err) {
      setSetupError((err as Error).message);
    } finally {
      setSetupBusy(false);
    }
  };

  const closeSetupModal = () => {
    if (setupStep === 'backupCodes' && !window.confirm(t('admin_2fa_backup_close_confirm'))) {
      return;
    }
    setSetupOpen(false);
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const openDisable = () => {
    setDisablePassword(''); setDisableCode(''); setDisableError('');
    setDisableOpen(true);
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableBusy(true); setDisableError('');
    try {
      await twoFactor.disable(disablePassword, disableCode.trim());
      setTotpEnabled(false);
      setDisableOpen(false);
    } catch (err) {
      setDisableError((err as Error).message);
    } finally {
      setDisableBusy(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('admin_settings_title')}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('admin_settings_sub')}
        </p>
      </div>

      <div className="surface rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('admin_2fa_title')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('admin_2fa_desc')}
            </p>
          </div>
          <Badge variant={totpEnabled ? 'green' : 'gray'}>
            {totpEnabled ? t('admin_2fa_active') : t('admin_2fa_inactive')}
          </Badge>
        </div>

        {totpEnabled ? (
          <Button variant="danger" size="sm" onClick={openDisable}>
            {t('admin_2fa_disable_btn')}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={openSetup}>
            {t('admin_2fa_enable_btn')}
          </Button>
        )}
      </div>

      {/* ── Modal de activación ──────────────────────────────────────────── */}
      <Modal open={setupOpen} onClose={closeSetupModal} title={t('admin_2fa_setup_title')}>
        {setupStep === 'scan' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              {t('admin_2fa_setup_intro')}
            </p>

            {setupBusy && !secret ? (
              <div className="flex justify-center py-6">
                <span className="text-sm text-slate-500">{t('admin_2fa_generating')}</span>
              </div>
            ) : (
              <>
                {otpauthUrl && (
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-xl">
                      <QRCodeSVG value={otpauthUrl} size={180} />
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1.5">
                    {t('admin_2fa_manual_label')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-slate-200 bg-dark-700 border border-white/[0.08] rounded-lg px-3 py-2.5 font-mono break-all">
                      {secret}
                    </code>
                    <Button type="button" variant="secondary" size="sm" onClick={copySecret}>
                      {secretCopied ? t('admin_2fa_copied') : t('admin_2fa_copy')}
                    </Button>
                  </div>
                </div>

                <form onSubmit={confirmSetup} className="space-y-4">
                  <Input
                    label={t('admin_2fa_code_label')}
                    type="text"
                    value={setupCode}
                    onChange={e => setSetupCode(e.target.value)}
                    placeholder="123456"
                    autoFocus
                    autoComplete="one-time-code"
                    required
                  />

                  {setupError && <p className="text-xs text-rose-400">{setupError}</p>}

                  <Button type="submit" loading={setupBusy} className="w-full" size="lg">
                    {t('admin_2fa_confirm_activate')}
                  </Button>
                </form>
              </>
            )}
          </div>
        )}

        {setupStep === 'backupCodes' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-4 py-3 rounded-xl">
              {t('admin_2fa_backup_warning')}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map(code => (
                <code
                  key={code}
                  className="text-sm text-slate-200 bg-dark-700 border border-white/[0.08] rounded-lg px-3 py-2 font-mono text-center"
                >
                  {code}
                </code>
              ))}
            </div>

            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={() => setSetupOpen(false)}
            >
              {t('admin_2fa_backup_done')}
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Modal de desactivación ───────────────────────────────────────── */}
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title={t('admin_2fa_disable_btn')}>
        <form onSubmit={confirmDisable} className="space-y-4">
          <p className="text-xs text-slate-500">
            {t('admin_2fa_disable_intro')}
          </p>
          <Input
            label={t('admin_2fa_password_label')}
            type="password"
            value={disablePassword}
            onChange={e => setDisablePassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            required
          />
          <Input
            label={t('verify2fa_code_label')}
            type="text"
            value={disableCode}
            onChange={e => setDisableCode(e.target.value)}
            placeholder={t('verify2fa_code_placeholder')}
            autoComplete="one-time-code"
            required
          />
          {disableError && <p className="text-xs text-rose-400">{disableError}</p>}
          <Button type="submit" variant="danger" loading={disableBusy} className="w-full" size="lg">
            {t('admin_2fa_disable_btn')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
