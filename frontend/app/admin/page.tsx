'use client';

import { useState, useEffect } from 'react';
import { admin as adminApi } from '@/lib/api';
import { StatsCard } from '@/components/admin/StatsCard';
import { PageLoader } from '@/components/ui/Spinner';

interface Stats {
  totalClients: number; totalCampaigns: number;
  activeCampaigns: number; completedCampaigns: number;
}

export default function AdminDashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Panel de administrador</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Clientes"       value={stats?.totalClients ?? 0}      icon="👤" color="blue"   />
        <StatsCard title="Total campañas" value={stats?.totalCampaigns ?? 0}    icon="📣" color="purple" />
        <StatsCard title="En proceso"     value={stats?.activeCampaigns ?? 0}   icon="⚡" color="yellow" />
        <StatsCard title="Completadas"    value={stats?.completedCampaigns ?? 0} icon="✅" color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/clients" className="surface rounded-xl p-5 hover:bg-white/[0.04] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">👤</div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Clientes</p>
            <p className="text-xs text-slate-500">Ver todos los clientes</p>
          </div>
        </a>
        <a href="/admin/campaigns" className="surface rounded-xl p-5 hover:bg-white/[0.04] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl">📣</div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Campañas</p>
            <p className="text-xs text-slate-500">Ver todas las campañas</p>
          </div>
        </a>
        <a href="/admin/plan-limits" className="surface rounded-xl p-5 hover:bg-white/[0.04] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xl">⚙️</div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Límites de planes</p>
            <p className="text-xs text-slate-500">Configurar capacidades por plan</p>
          </div>
        </a>
      </div>
    </div>
  );
}
