type Variant = 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'indigo';

interface Props {
  children: React.ReactNode;
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  gray:   'bg-slate-700/60  text-slate-300  border-slate-600/40',
  blue:   'bg-blue-500/15   text-blue-300   border-blue-500/30',
  yellow: 'bg-amber-500/15  text-amber-300  border-amber-500/30',
  green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red:    'bg-rose-500/15   text-rose-300   border-rose-500/30',
  purple: 'bg-violet-500/15 text-violet-300  border-violet-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-300  border-indigo-500/30',
};

export function Badge({ children, variant = 'gray' }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}

export function campaignStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    draft:             { label: 'Borrador',         variant: 'gray'   },
    generating:        { label: 'Generando...',     variant: 'blue'   },
    pending_selection: { label: 'Elige estrategia', variant: 'yellow' },
    creating_media:    { label: 'Creando media',    variant: 'purple' },
    publishing:        { label: 'Publicando...',    variant: 'indigo' },
    completed:         { label: 'Completada',       variant: 'green'  },
    failed:            { label: 'Error',            variant: 'red'    },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' as Variant };
  return <Badge variant={variant}>{label}</Badge>;
}
