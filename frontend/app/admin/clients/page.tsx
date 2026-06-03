'use client';

import { useState, useEffect } from 'react';
import { admin as adminApi } from '@/lib/api';
import { ClientsTable } from '@/components/admin/ClientsTable';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<never[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.listClients().then(d => setClients(d.clients as never[])).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Clientes ({clients.length})</h1>
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <CardHeader title="Todos los clientes" />
        </div>
        <ClientsTable clients={clients as Parameters<typeof ClientsTable>[0]['clients']} />
      </Card>
    </div>
  );
}
