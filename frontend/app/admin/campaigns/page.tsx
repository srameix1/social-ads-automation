'use client';

import { useState, useEffect } from 'react';
import { admin as adminApi } from '@/lib/api';
import { CampaignsTable } from '@/components/admin/CampaignsTable';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<never[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    adminApi.listCampaigns().then(d => setCampaigns(d.campaigns as never[])).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Campañas ({campaigns.length})</h1>
      <Card padding={false}>
        <CampaignsTable campaigns={campaigns as Parameters<typeof CampaignsTable>[0]['campaigns']} />
      </Card>
    </div>
  );
}
