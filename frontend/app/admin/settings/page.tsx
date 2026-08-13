'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { auth, twoFactor } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';

type SetupStep = 'scan' | 'backupCodes';

export default function AdminSettingsPage() {
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
        <h1 className="text-2xl font-bold text-white">Configuración de la cuenta</h1>
        <p className="text-slate-500 text-sm mt-1">
          Preferencias y seguridad de tu cuenta de administrador.
        </p>
      </div>

      <div className="surface rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Autenticación de dos factores (2FA)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pedí un código de tu app de autenticación además de la contraseña al iniciar sesión.
            </p>
          </div>
          <Badge variant={totpEnabled ? 'green' : 'gray'}>
            {totpEnabled ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {totpEnabled ? (
          <Button variant="danger" size="sm" onClick={openDisable}>
            Desactivar 2FA
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={openSetup}>
            Activar 2FA
          </Button>
        )}
      </div>

      {/* ── Modal de activación ──────────────────────────────────────────── */}
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Activar verificación en dos pasos">
        {setupStep === 'scan' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Escaneá este código con tu app de autenticación (Google Authenticator, Authy, 1Password, etc.),
              o ingresá el secreto manualmente si no podés escanear.
            </p>

            {setupBusy && !secret ? (
              <div className="flex justify-center py-6">
                <span className="text-sm text-slate-500">Generando secreto...</span>
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
                    O ingresá este código manualmente
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-slate-200 bg-dark-700 border border-white/[0.08] rounded-lg px-3 py-2.5 font-mono break-all">
                      {secret}
                    </code>
                    <Button type="button" variant="secondary" size="sm" onClick={copySecret}>
                      {secretCopied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </div>

                <form onSubmit={confirmSetup} className="space-y-4">
                  <Input
                    label="Código de 6 dígitos"
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
                    Confirmar y activar
                  </Button>
                </form>
              </>
            )}
          </div>
        )}

        {setupStep === 'backupCodes' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-4 py-3 rounded-xl">
              Guardá estos códigos de respaldo en un lugar seguro. Cada uno sirve una sola vez para
              entrar si perdés acceso a tu app de autenticación — no vas a poder verlos de nuevo.
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
              Ya los guardé
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Modal de desactivación ───────────────────────────────────────── */}
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Desactivar 2FA">
        <form onSubmit={confirmDisable} className="space-y-4">
          <p className="text-xs text-slate-500">
            Confirmá tu contraseña y un código válido (de tu app o uno de respaldo) para desactivar
            la verificación en dos pasos.
          </p>
          <Input
            label="Contraseña actual"
            type="password"
            value={disablePassword}
            onChange={e => setDisablePassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            required
          />
          <Input
            label="Código"
            type="text"
            value={disableCode}
            onChange={e => setDisableCode(e.target.value)}
            placeholder="123456 o código de respaldo"
            autoComplete="one-time-code"
            required
          />
          {disableError && <p className="text-xs text-rose-400">{disableError}</p>}
          <Button type="submit" variant="danger" loading={disableBusy} className="w-full" size="lg">
            Desactivar 2FA
          </Button>
        </form>
      </Modal>
    </div>
  );
}
