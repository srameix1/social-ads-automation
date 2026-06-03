'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { admin as adminApi } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, campaignStatusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client,  setClient]  = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getClient(id).then(d => setClient(d.client as Record<string, unknown>)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!client) return <p className="text-center py-20 text-slate-500">Cliente no encontrado</p>;

  const campaigns = (client.campaigns as { id: string; title: string; status: string; created_at: string }[]) ?? [];
  const platforms = (client.connectedPlatforms as string[]) ?? [];

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
            {campaigns.map(c => (
              <Link key={c.id} href={`/admin/campaigns/${c.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.03] transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-200">{c.title}</p>
                  <p className="text-xs text-slate-600">{new Date(c.created_at).toLocaleDateString('es-MX')}</p>
                </div>
                {campaignStatusBadge(c.status)}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
