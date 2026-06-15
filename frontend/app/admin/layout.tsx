'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/ui/Spinner';

const NAV = [
  { href: '/admin',              label: 'Dashboard',      exact: true },
  { href: '/admin/clients',      label: 'Clientes'                    },
  { href: '/admin/campaigns',    label: 'Campañas'                    },
  { href: '/admin/plan-limits',  label: 'Límites de planes'           },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-dark-950">
      <nav className="border-b border-white/[0.06] px-6 py-3 bg-dark-900">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-sm font-bold text-brand-400 tracking-wider uppercase">SANADS Admin</span>
            <div className="flex items-center gap-1">
              {NAV.map(item => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? 'bg-brand-500/15 text-brand-300'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                      }`}>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600">{user?.email}</span>
            <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Salir
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
