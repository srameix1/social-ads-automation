'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { admin as adminApi } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, campaignStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  basic:        { label: 'Básico',       color: 'text-slate-300' },
  professional: { label: 'Profesional',  color: 'text-brand-400' },
  premium:      { label: 'Premium',      color: 'text-violet-400' },
};

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client,  setClient]  = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [maxPostsInput,   setMaxPostsInput]   = useState('');
  const [savingLimit,     setSavingLimit]     = useState(false);

  useEffect(() => {
    adminApi.getClient(id)
      .then(d => setClient(d.client as unknown as Record<string, unknown>))
      .finally(() => setLoading(false));
  }, [id]);

  const saveMaxPosts = async (campaignId: string) => {
    const val = parseInt(maxPostsInput);
    if (!val || val < 1) return;
    setSavingLimit(true);
    try {
      await adminApi.updateCampaignMaxPosts(campaignId, val);
      setClient(prev => {
        if (!prev) return prev;
        const campaigns = (prev.campaigns as Record<string, unknown>[]).map(c =>
          c.id === campaignId ? { ...c, max_posts: val } : c,
        );
        return { ...prev, campaigns };
      });
      setEditingCampaign(null);
    } finally {
      setSavingLimit(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!client) return <p className="text-center py-20 text-slate-500">Cliente no encontrado</p>;

  const campaigns = (client.campaigns as {
    id: string; title: string; status: string;
    month_year: string | null; max_posts: number; posts_used: number; created_at: string;
  }[]) ?? [];
  const platforms   = (client.connectedPlatforms as string[]) ?? [];
  const planKey     = (client.plan as string) ?? 'basic';
  const planMeta    = PLAN_LABELS[planKey] ?? { label: planKey, color: 'text-slate-300' };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-slate-500 hover:text-slate-300 mb-1 block transition-colors">
          ← Clientes
        </Link>
        <h1 className="text-2xl font-bold text-white">{client.business_name as string || client.email as string}</h1>
        <p className="text-slate-500 text-sm">{client.email as string}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Información" />
          <div className="space-y-2 text-sm">
            <div><p className="text-xs text-slate-500">Email</p><p className="text-slate-300">{client.email as string}</p></div>
            <div>
              <p className="text-xs text-slate-500">Plan</p>
              <p className={`font-medium ${planMeta.color}`}>{planMeta.label}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estado cuenta</p>
              <Badge variant={client.is_active ? 'green' : 'red'}>
                {client.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500">Perfil</p>
              <Badge variant={client.setup_completed ? 'green' : 'yellow'}>
                {client.setup_completed ? 'Completo' : 'Pendiente'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500">Redes conectadas</p>
              <p className="text-slate-300">{platforms.length ? platforms.join(', ') : 'Ninguna'}</p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Descripción" />
          <p className="text-sm text-slate-400">{(client.description as string) || 'Sin descripción'}</p>
        </Card>
      </div>

      <Card padding={false}>
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-slate-200">Campañas ({campaigns.length})</h2>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-center py-8 text-slate-600 text-sm">Sin campañas</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {campaigns.map(c => {
              const pct     = Math.min(((c.posts_used ?? 0) / (c.max_posts ?? 20)) * 100, 100);
              const atLimit = (c.posts_used ?? 0) >= (c.max_posts ?? 20);
              const isEditingThis = editingCampaign === c.id;

              return (
                <div key={c.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/admin/campaigns/${c.id}`}
                        className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
                        {c.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-600">
                          {c.month_year ?? new Date(c.created_at).toLocaleDateString('es-MX')}
                        </p>
                        {c.month_year && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span className="text-xs text-slate-600">{c.month_year}</span>
                          </>
                        )}
                      </div>

                      {/* Posts usage */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-24 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${atLimit ? 'bg-rose-500' : 'bg-brand-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs ${atLimit ? 'text-rose-400' : 'text-slate-500'}`}>
                          {c.posts_used ?? 0}/{c.max_posts ?? 20} anuncios
                        </span>

                        {/* Inline limit editor */}
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5 ml-1">
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={maxPostsInput}
                              onChange={e => setMaxPostsInput(e.target.value)}
                              className="w-14 text-center bg-white/[0.06] border border-white/[0.12] rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500/60"
                            />
                            <button
                              onClick={() => saveMaxPosts(c.id)}
                              disabled={savingLimit}
                              className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50"
                            >
                              {savingLimit ? '...' : 'OK'}
                            </button>
                            <button
                              onClick={() => setEditingCampaign(null)}
                              className="text-xs text-slate-500 hover:text-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingCampaign(c.id); setMaxPostsInput(String(c.max_posts ?? 20)); }}
                            className="text-xs text-slate-600 hover:text-slate-400 underline ml-1"
                          >
                            Editar límite
                          </button>
                        )}
                      </div>
                    </div>

                    {campaignStatusBadge(c.status)}
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
