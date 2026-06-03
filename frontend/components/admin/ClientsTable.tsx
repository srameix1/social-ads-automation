import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

interface Client {
  id:              string;
  email:           string;
  business_name:   string;
  setup_completed: boolean;
  is_active:       boolean;
  campaign_count:  string | number;
  created_at:      string;
}

export function ClientsTable({ clients }: { clients: Client[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Negocio</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Perfil</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Campañas</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Registro</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map(c => (
            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 font-medium text-gray-900">{c.email}</td>
              <td className="py-3 px-4 text-gray-600">{c.business_name || '—'}</td>
              <td className="py-3 px-4">
                <Badge variant={c.setup_completed ? 'green' : 'yellow'}>
                  {c.setup_completed ? 'Completo' : 'Pendiente'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-gray-600">{c.campaign_count ?? 0}</td>
              <td className="py-3 px-4 text-gray-400 text-xs">
                {new Date(c.created_at).toLocaleDateString('es-MX')}
              </td>
              <td className="py-3 px-4">
                <Link href={`/admin/clients/${c.id}`}
                  className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                  Ver →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
