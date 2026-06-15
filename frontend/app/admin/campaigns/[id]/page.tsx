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

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    adminApi.getCampaign(id).then(d => setCampaign(d.campaign as unknown as Record<string, unknown>)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!campaign) return <p className="text-center py-20 text-slate-500">Campaña no encontrada</p>;

  const strategies   = (campaign.strategies   as { id: string; title: string; description: string; selected: boolean; tone: string }[]) ?? [];
  const publications = (campaign.publications as Publication[]) ?? [];

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
    </div>
  );
}
