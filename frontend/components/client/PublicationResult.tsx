import { Publication } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

interface Props {
  publications: Publication[];
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  tiktok:    '🎵',
  facebook:  '👥',
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok:    'TikTok',
  facebook:  'Facebook',
};

export function PublicationResult({ publications }: Props) {
  if (!publications.length) return null;

  return (
    <div className="space-y-2">
      {publications.map(pub => (
        <div key={pub.id}
          className="flex items-center justify-between p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="text-xl">{PLATFORM_ICONS[pub.platform] ?? '🌐'}</span>
            <div>
              <p className="text-sm font-medium text-slate-200">
                {PLATFORM_NAMES[pub.platform] ?? pub.platform}
              </p>
              {pub.published_at && (
                <p className="text-xs text-slate-600">
                  {new Date(pub.published_at).toLocaleString('es-MX')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pub.status === 'published' ? (
              <>
                <Badge variant="green">Publicado</Badge>
                {pub.post_url && (
                  <a href={pub.post_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">
                    Ver post →
                  </a>
                )}
              </>
            ) : pub.status === 'failed' ? (
              <Badge variant="red">Error</Badge>
            ) : (
              <Badge variant="yellow">Pendiente</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
