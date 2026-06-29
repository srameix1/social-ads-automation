'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { credentials, oauth } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { CredentialStatus } from '@/lib/types';

const PLATFORM_META: Record<string, {
  label: string;
  description: string;
  note?: string;
  icon: React.ReactNode;
  color: string;
  managedBy?: string;
}> = {
  facebook: {
    label: 'Facebook',
    description: 'Publica en tu Página de Facebook',
    color: 'blue',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    description: 'Se conecta automáticamente al vincular Facebook',
    note: 'Requiere una cuenta de Instagram Business enlazada a tu Página de Facebook',
    color: 'pink',
    managedBy: 'facebook',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
  tiktok: {
    label: 'TikTok',
    description: 'Publica videos en tu cuenta de TikTok',
    color: 'slate',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.28 8.28 0 004.84 1.54V7.01a4.85 4.85 0 01-1.07-.32z"/>
      </svg>
    ),
  },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  blue:  { bg: 'bg-blue-500/10',  text: 'text-blue-400',  border: 'border-blue-500/30' },
  pink:  { bg: 'bg-pink-500/10',  text: 'text-pink-400',  border: 'border-pink-500/30' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-300',  border: 'border-slate-500/30' },
};

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<CredentialStatus[]>([]);
  const [loading, setLoading]   = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadStatuses = useCallback(async () => {
    try {
      const { credentials: creds } = await credentials.list();
      setStatuses(creds);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');
    if (connected) {
      setNotification({ type: 'success', message: `${PLATFORM_META[connected]?.label ?? connected} conectado correctamente.` });
      loadStatuses();
      window.history.replaceState({}, '', '/connect');
    } else if (error) {
      setNotification({ type: 'error', message: decodeURIComponent(error) });
      window.history.replaceState({}, '', '/connect');
    }
  }, [searchParams, loadStatuses]);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(t);
  }, [notification]);

  const { logout } = useAuth();
  const statusMap = new Map(statuses.map(s => [s.platform, s]));

  async function connect(platform: 'facebook' | 'tiktok') {
    setConnecting(platform);
    try {
      const initFn = platform === 'facebook' ? oauth.initFacebook : oauth.initTikTok;
      const { url } = await initFn();
      window.location.href = url;
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
      setConnecting(null);
    }
  }

  async function disconnect(platform: string) {
    setConnecting(platform);
    try {
      await oauth.disconnect(platform);
      setNotification({ type: 'success', message: `${PLATFORM_META[platform]?.label} desconectado.` });
      await loadStatuses();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Redes sociales</h1>
        <p className="text-slate-400 text-sm">
          Conecta tus cuentas para que el sistema pueda publicar automáticamente.
        </p>
      </div>

      {notification && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-4 text-sm text-amber-50">
        <p className="font-semibold text-amber-200">
          Para continuar usando Spotflow, debes conectar al menos tu cuenta de Facebook.
        </p>
        <p className="mt-2 text-[0.93rem] text-amber-100/90">
          ¿No puedes hacerlo ahora? Puedes{' '}
          <button onClick={logout} className="font-medium text-amber-200 underline underline-offset-2 transition-colors hover:text-amber-100">
            Cerrar sesión
          </button>{' '}
          y volver cuando tengas tus datos de Facebook listos.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(['facebook', 'instagram', 'tiktok'] as const).map(platform => {
            const meta      = PLATFORM_META[platform];
            const status    = statusMap.get(platform);
            const connected = status?.connected ?? false;
            const colors    = COLOR_CLASSES[meta.color];
            const isBusy    = connecting === platform;
            const isManaged = !!meta.managedBy;

            return (
              <div
                key={platform}
                className="flex items-center gap-4 px-5 py-4 rounded-xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{meta.label}</span>
                    {connected && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Conectado
                      </span>
                    )}
                    {isManaged && (
                      <span className="px-1.5 py-0.5 rounded text-xs text-slate-500 border border-slate-700">
                        vía Facebook
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                  {meta.note && (
                    <p className="text-xs text-slate-600 mt-0.5 italic">{meta.note}</p>
                  )}
                  {connected && status?.updated_at && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Conectado el {new Date(status.updated_at).toLocaleDateString('es')}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {isManaged ? (
                    // Instagram is managed automatically via Facebook — no separate button
                    <span className="text-xs text-slate-600">Automático</span>
                  ) : connected ? (
                    <button
                      onClick={() => disconnect(platform)}
                      disabled={!!connecting}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {isBusy ? 'Desconectando…' : 'Desconectar'}
                    </button>
                  ) : (
                    <button
                      onClick={() => connect(platform as 'facebook' | 'tiktok')}
                      disabled={!!connecting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors disabled:opacity-50"
                    >
                      {isBusy ? 'Redirigiendo…' : 'Conectar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Seguridad:</strong> tus tokens de acceso se almacenan cifrados con AES-256-GCM.
          Nunca los compartimos con terceros. Puedes desconectar tus cuentas en cualquier momento.
        </p>
      </div>

      <div className="mt-4 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <p className="text-sm font-semibold text-white mb-2">¿Problemas para conectar?</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Debes ser administrador de la Página de Facebook que quieres conectar. Si necesitas ayuda, contacta a soporte en{' '}
          <a href="mailto:contact@spotflow.pro" className="text-violet-400 hover:text-violet-300 transition-colors">
            contact@spotflow.pro
          </a>.
        </p>
      </div>
    </div>
  );
}
