'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { admin as adminApi } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { campaignStatusBadge, Badge } from '@/components/ui/Badge';
import { PublicationResult } from '@/components/client/PublicationResult';
import { PageLoader } from '@/components/ui/Spinner';
import type { Publication } from '@/lib/types';

interface CampaignPostRow {
  id:                          string;
  workflow_status:             string;
  status:                      string;
  platforms:                   string[];
  format:                      string;
  scheduled_date:              string | null;
  created_at:                  string;
  copy_generation_attempts:    number;
  visual_generation_attempts:  number;
}

const WORKFLOW_LABELS: Record<string, string> = {
  draft:               'Borrador',
  described:           'Descrito',
  generating_copy:     'Generando copy',
  copy_ready:          'Copy listo',
  generating_visuals:  'Generando visuales',
  visuals_ready:       'Visuales listos',
  visuals_failed:      'Visuales fallidos',
  visual_selected:     'Visual elegido',
  generating_video:    'Generando video',
  confirmed:           'Confirmado',
};

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [savingAttemptKey, setSavingAttemptKey] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getCampaign(id).then(d => setCampaign(d.campaign as unknown as Record<string, unknown>)).finally(() => setLoading(false));
  }, [id]);

  const adjustAttempts = async (
    postId: string,
    field:  'copy_generation_attempts' | 'visual_generation_attempts',
    currentValue: number,
    delta:  number,
  ) => {
    const next = Math.max(0, currentValue + delta);
    const key  = `${postId}:${field}`;
    setSavingAttemptKey(key);
    try {
      await adminApi.updatePostAttempts(postId, { [field]: next });
      setCampaign(prev => {
        if (!prev) return prev;
        const posts = ((prev.posts as CampaignPostRow[]) ?? []).map(p =>
          p.id === postId ? { ...p, [field]: next } : p,
        );
        return { ...prev, posts };
      });
    } finally {
      setSavingAttemptKey(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!campaign) return <p className="text-center py-20 text-slate-500">Campaña no encontrada</p>;

  const strategies      = (campaign.strategies   as { id: string; title: string; description: string; selected: boolean; tone: string }[]) ?? [];
  const publications    = (campaign.publications as Publication[]) ?? [];
  const campaignPosts   = (campaign.posts as CampaignPostRow[]) ?? [];
  const maxCopyAttempts   = (campaign.maxCopyAttempts   as number) ?? 5;
  const maxVisualAttempts = (campaign.maxVisualAttempts as number) ?? 2;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/admin/campaigns" className="text-sm text-slate-500 hover:text-slate-300 mb-1 block transition-colors">
          ← Campañas
        </Link>
        <h1 className="text-2xl font-bold text-white">{campaign.title as string}</h1>
        <div className="flex items-center gap-3 mt-2">
          {campaignStatusBadge(campaign.status as string)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Detalles" />
          <div className="space-y-2 text-sm">
            <div><p className="text-xs text-slate-500">Objetivo</p><p className="text-slate-300">{campaign.objective as string || '—'}</p></div>
            <div><p className="text-xs text-slate-500">Audiencia</p><p className="text-slate-300">{campaign.target_audience as string || '—'}</p></div>
            <div>
              <p className="text-xs text-slate-500">Plataformas</p>
              <p className="text-slate-300">{((campaign.platforms as string[]) ?? []).join(', ')}</p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Estrategias" />
          <div className="space-y-2">
            {strategies.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <p className="text-sm text-slate-400 truncate">{s.title}</p>
                {s.selected && <Badge variant="green">Elegida</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {publications.length > 0 && (
        <Card>
          <CardHeader title="Publicaciones" />
          <PublicationResult publications={publications} />
        </Card>
      )}

      <Card padding={false}>
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-slate-200">Anuncios ({campaignPosts.length})</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ajusta manualmente los intentos de regeneración si un cliente perdió uno por un error técnico.
          </p>
        </div>
        {campaignPosts.length === 0 ? (
          <p className="text-center py-8 text-slate-600 text-sm">Sin anuncios</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {campaignPosts.map(p => {
              const copyKey   = `${p.id}:copy_generation_attempts`;
              const visualKey = `${p.id}:visual_generation_attempts`;
              return (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{p.id.slice(0, 8)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="blue">{WORKFLOW_LABELS[p.workflow_status] ?? p.workflow_status}</Badge>
                      <span className="text-xs text-slate-600">{p.format}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Copy attempts */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">Copy</span>
                      <Badge variant={p.copy_generation_attempts >= maxCopyAttempts ? 'red' : 'blue'}>
                        {p.copy_generation_attempts}/{maxCopyAttempts}
                      </Badge>
                      <button
                        onClick={() => adjustAttempts(p.id, 'copy_generation_attempts', p.copy_generation_attempts, -1)}
                        disabled={savingAttemptKey === copyKey}
                        className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.12] text-slate-400 hover:bg-white/[0.06] disabled:opacity-50"
                        title="Bajar intentos de copy en 1"
                      >
                        −
                      </button>
                      <button
                        onClick={() => adjustAttempts(p.id, 'copy_generation_attempts', p.copy_generation_attempts, 1)}
                        disabled={savingAttemptKey === copyKey}
                        className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.12] text-slate-400 hover:bg-white/[0.06] disabled:opacity-50"
                        title="Subir intentos de copy en 1"
                      >
                        +
                      </button>
                    </div>

                    {/* Visual attempts */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">Imágenes</span>
                      <Badge variant={p.visual_generation_attempts >= maxVisualAttempts ? 'red' : 'blue'}>
                        {p.visual_generation_attempts}/{maxVisualAttempts}
                      </Badge>
                      <button
                        onClick={() => adjustAttempts(p.id, 'visual_generation_attempts', p.visual_generation_attempts, -1)}
                        disabled={savingAttemptKey === visualKey}
                        className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.12] text-slate-400 hover:bg-white/[0.06] disabled:opacity-50"
                        title="Bajar intentos de imágenes en 1"
                      >
                        −
                      </button>
                      <button
                        onClick={() => adjustAttempts(p.id, 'visual_generation_attempts', p.visual_generation_attempts, 1)}
                        disabled={savingAttemptKey === visualKey}
                        className="w-5 h-5 flex items-center justify-center rounded border border-white/[0.12] text-slate-400 hover:bg-white/[0.06] disabled:opacity-50"
                        title="Subir intentos de imágenes en 1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
