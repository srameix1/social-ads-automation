import Link from 'next/link';
import { campaignStatusBadge } from '@/components/ui/Badge';

interface Campaign {
  id:            string;
  title:         string;
  status:        string;
  platforms:     string[];
  client_email:  string;
  business_name: string;
  created_at:    string;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', facebook: '👥',
};

export function CampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Campaña</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Estado</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Plataformas</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Fecha</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {campaigns.map(c => (
            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 font-medium text-gray-900 max-w-[200px] truncate">{c.title}</td>
              <td className="py-3 px-4 text-gray-600">
                <p className="font-medium">{c.business_name || '—'}</p>
                <p className="text-xs text-gray-400">{c.client_email}</p>
              </td>
              <td className="py-3 px-4">{campaignStatusBadge(c.status)}</td>
              <td className="py-3 px-4">
                <div className="flex gap-1">
                  {(c.platforms ?? []).map(p => (
                    <span key={p} title={p}>{PLATFORM_ICONS[p] ?? p}</span>
                  ))}
                </div>
              </td>
              <td className="py-3 px-4 text-gray-400 text-xs">
                {new Date(c.created_at).toLocaleDateString('es-MX')}
              </td>
              <td className="py-3 px-4">
                <Link href={`/admin/campaigns/${c.id}`}
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
