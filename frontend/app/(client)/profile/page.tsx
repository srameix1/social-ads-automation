'use client';

import { useState, useEffect, useRef } from 'react';
import { clients, credentials as credentialsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_MAP } from '@/lib/i18n';
import type { ClientProfile, CredentialStatus } from '@/lib/types';

const PLATFORMS = [
  { id: 'instagram' as const, label: 'Instagram', color: 'from-pink-500 to-orange-500',
    fields: [
      { key: 'access_token',         label: 'Access Token',         type: 'password' },
      { key: 'instagram_account_id', label: 'Instagram Account ID', type: 'text'     },
    ]},
  { id: 'tiktok' as const, label: 'TikTok', color: 'from-slate-700 to-slate-900',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password' },
      { key: 'open_id',      label: 'Open ID',      type: 'text'     },
    ]},
  { id: 'facebook' as const, label: 'Facebook', color: 'from-blue-600 to-blue-800',
    fields: [
      { key: 'page_access_token', label: 'Page Access Token', type: 'password' },
      { key: 'page_id',           label: 'Page ID',           type: 'text'     },
    ]},
];

const PLAN_LABELS: Record<string, {
  label_es: string; label_en: string; label_pt: string; price: string; color: string; benefit: string;
}> = {
  basic:        { label_es: 'Básico',       label_en: 'Basic',        label_pt: 'Básico',        price: '$97/mes',  color: 'text-slate-300',  benefit: '20 imágenes/mes' },
  professional: { label_es: 'Profesional',  label_en: 'Professional', label_pt: 'Profissional',  price: '$197/mes', color: 'text-brand-400',  benefit: '24 anuncios/mes — imagen o video animado' },
  premium:      { label_es: 'Premium',      label_en: 'Premium',      label_pt: 'Premium',       price: '$397/mes', color: 'text-violet-400', benefit: '30 anuncios/mes — 8 videos Veo 2 incluidos + imagen o video animado' },
};

export default function ProfilePage() {
  const { t, lang } = useLanguage();
  const [profile, setProfile]   = useState<ClientProfile | null>(null);
  const [creds,   setCreds]     = useState<CredentialStatus[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal,   setModal]     = useState<typeof PLATFORMS[0] | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving,     setSaving]    = useState(false);
  const [msg,        setMsg]       = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Business info editing
  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState('');
  const [editDesc,    setEditDesc]    = useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  const [editMsg,     setEditMsg]     = useState('');

  // Logo upload
  const logoInputRef               = useRef<HTMLInputElement>(null);
  const [logoFile,    setLogoFile]  = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([clients.getProfile(), credentialsApi.list()])
      .then(([p, c]) => { setProfile(p.profile); setCreds(c.credentials); })
      .catch(err => setFetchError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const startEditing = () => {
    setEditName(profile?.business_name ?? '');
    setEditDesc(profile?.description   ?? '');
    setEditMsg('');
    setLogoFile(null);
    setLogoPreview(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setEditing(false);
    setEditMsg('');
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setEditMsg('El logo no puede superar 2 MB'); return; }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setEditMsg('');
  };

  const saveBusinessInfo = async () => {
    if (!editName.trim()) { setEditMsg(t('prof_edit_name_required')); return; }
    setEditSaving(true); setEditMsg('');
    try {
      // Upload logo first if a new file was selected
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        const res = await clients.uploadBrandLogo(fd) as { profile?: { brand_logo_url?: string } };
        if (res?.profile?.brand_logo_url) {
          setProfile(p => p ? { ...p, brand_logo_url: res.profile!.brand_logo_url! } : p);
        }
      }
      await clients.updateProfile({ business_name: editName.trim(), description: editDesc.trim() });
      setProfile(p => p ? { ...p, business_name: editName.trim(), description: editDesc.trim() } : p);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(null);
      setLogoPreview(null);
      setEditing(false);
    } catch (err) {
      setEditMsg((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const openModal = (platform: typeof PLATFORMS[0]) => {
    setFormData({}); setMsg(''); setModal(platform);
  };

  const saveCreds = async () => {
    if (!modal) return;
    setSaving(true); setMsg('');
    try {
      await credentialsApi.save(modal.id, formData);
      const updated = await credentialsApi.list();
      setCreds(updated.credentials);
      setModal(null);
    } catch (err) {
      setMsg((err as Error).message);
    } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;
  if (fetchError) return (
    <div className="flex items-center gap-3 text-sm text-rose-400 border border-rose-500/20 bg-rose-500/5 px-4 py-3 rounded-xl">
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      {fetchError}
    </div>
  );

  const planKey = profile?.plan ?? 'basic';
  const planInfo = PLAN_LABELS[planKey];
  const planLabel = planInfo
    ? (lang === 'es' ? planInfo.label_es : lang === 'pt' ? planInfo.label_pt : planInfo.label_en)
    : planKey;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('prof_title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('prof_sub')}</p>
      </div>

      {/* Business info */}
      <div className="surface rounded-xl p-5">
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('prof_business')}</h2>
          <div className="flex items-center gap-3">
            {planInfo && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${planInfo.color}`}>{planLabel}</span>
                  <span className="text-xs text-slate-600">{planInfo.price}</span>
                </div>
                <span className="text-[11px] text-slate-500">{planInfo.benefit}</span>
              </div>
            )}
            {!editing && (
              <button
                onClick={startEditing}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
              >
                {t('prof_edit')}
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <Input
              label={t('prof_name')}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={t('step2_name_ph')}
            />
            <Textarea
              label={t('prof_description')}
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder={t('step2_desc_ph')}
              rows={4}
            />

            {/* Logo upload */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">{t('brand_logo')}</p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />

              {/* Preview or upload zone */}
              {(logoPreview ?? profile?.brand_logo_url) ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img
                      src={logoPreview ?? profile!.brand_logo_url!}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    {logoPreview && (
                      <p className="text-xs text-brand-400 font-medium">{t('prof_logo_new')}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors"
                    >
                      {logoPreview ? t('prof_logo_change_new') : t('prof_logo_change')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 px-4 py-6 rounded-xl border border-dashed border-white/[0.12] hover:border-brand-500/40 hover:bg-brand-500/5 transition-all text-slate-500 hover:text-slate-300"
                >
                  <svg className="w-7 h-7 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                  </svg>
                  <span className="text-sm font-medium">{t('prof_logo_upload_btn')}</span>
                  <span className="text-xs text-slate-600">{t('prof_logo_size_hint')}</span>
                </button>
              )}

              <p className="text-xs text-slate-600 mt-2">
                {t('prof_logo_tip')}
              </p>
            </div>

            {editMsg && <p className="text-xs text-rose-400">{editMsg}</p>}
            <div className="flex gap-3 pt-1">
              <button
                onClick={cancelEditing}
                disabled={editSaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 disabled:opacity-40 transition-colors"
              >
                {t('prof_cancel')}
              </button>
              <Button onClick={saveBusinessInfo} loading={editSaving} className="flex-1" variant="primary">
                {t('prof_save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-600 mb-1">{t('prof_name')}</p>
              <p className="text-sm font-medium text-slate-200">{profile?.business_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">{t('prof_description')}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{profile?.description || '—'}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant={profile?.setup_completed ? 'green' : 'yellow'}>
                {profile?.setup_completed ? t('prof_complete') : t('prof_pending')}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Social credentials */}
      <div className="surface rounded-xl p-5">
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('prof_social')}</h2>
          <p className="text-xs text-slate-600 mt-1">{t('prof_encrypted')}</p>
        </div>
        <div className="space-y-2">
          {PLATFORMS.map(platform => {
            const status = creds.find(c => c.platform === platform.id);
            return (
              <div
                key={platform.id}
                className="flex items-center justify-between p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center`}>
                    <span className="text-xs font-bold text-white">{platform.label[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{platform.label}</p>
                    {status?.updated_at && (
                      <p className="text-xs text-slate-600">
                        {t('prof_updated_at', new Date(status.updated_at).toLocaleDateString(LOCALE_MAP[lang]))}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={status?.connected ? 'green' : 'gray'}>
                    {status?.connected ? t('prof_connected') : t('prof_not_connected')}
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={() => openModal(platform)}>
                    {status?.connected ? t('prof_update') : t('prof_connect')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Credentials modal */}
      {modal && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={t('prof_modal_title', modal.label)}>
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{t('prof_modal_sub')}</p>
            {modal.fields.map(f => (
              <Input
                key={f.key}
                label={f.label}
                type={f.type as 'text' | 'password'}
                value={formData[f.key] ?? ''}
                onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder="••••••••"
              />
            ))}
            {msg && <p className="text-xs text-rose-400">{msg}</p>}
            <Button onClick={saveCreds} loading={saving} className="w-full" size="lg">
              {t('prof_save_creds')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
