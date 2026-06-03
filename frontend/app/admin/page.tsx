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
    </div>
  );
}
