'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Post, Publication } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_MAP } from '@/lib/i18n';

const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

function useWorkflowStyles(t: (key: string, ...args: any[]) => string): Record<string, { label: string; cls: string }> {
  return {
    draft:               { label: t('posts_wf_draft'),              cls: 'bg-slate-700 text-slate-300' },
    described:           { label: t('posts_wf_described'),          cls: 'bg-slate-700 text-slate-300' },
    generating_copy:     { label: t('posts_wf_generating_copy'),    cls: 'bg-blue-500/20 text-blue-300' },
    copy_ready:          { label: t('posts_wf_copy_ready'),          cls: 'bg-blue-500/20 text-blue-300' },
    generating_visuals:  { label: t('posts_wf_generating_visuals'), cls: 'bg-amber-500/20 text-amber-300' },
    visuals_ready:       { label: t('posts_wf_visuals_ready'),      cls: 'bg-violet-500/20 text-violet-300' },
    visuals_failed:      { label: t('posts_wf_visuals_failed'),     cls: 'bg-rose-500/20 text-rose-400' },
    visual_selected:     { label: t('posts_wf_visual_selected'),    cls: 'bg-violet-500/20 text-violet-300' },
    generating_video:    { label: t('posts_wf_generating_video'),   cls: 'bg-amber-500/20 text-amber-300' },
    confirmed:           { label: t('posts_wf_confirmed'),           cls: 'bg-emerald-500/20 text-emerald-300' },
  };
}

function useStatusStyles(t: (key: string, ...args: any[]) => string): Record<string, { label: string; cls: string }> {
  return {
    draft:      { label: t('posts_wf_draft'),          cls: 'bg-slate-700 text-slate-300' },
    scheduled:  { label: t('posts_status_scheduled'),  cls: 'bg-blue-500/20 text-blue-300' },
    publishing: { label: t('posts_status_publishing'), cls: 'bg-amber-500/20 text-amber-300' },
    published:  { label: t('posts_status_published'),  cls: 'bg-emerald-500/20 text-emerald-300' },
    failed:     { label: t('posts_status_failed'),      cls: 'bg-rose-500/20 text-rose-400' },
  };
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', facebook: '👥',
};

const FORMAT_ICONS: Record<string, string> = {
  image: '🖼️', animated_video: '🎞️', reel: '🎬',
};

const IN_PROGRESS_STATUSES = new Set([
  'draft', 'described', 'generating_copy', 'copy_ready',
  'generating_visuals', 'visuals_ready', 'visuals_failed', 'visual_selected', 'generating_video',
]);

// Fuente de verdad del indicador por plataforma: SOLO publications.status.
// post_id/post_url nunca se usan para decidir el color — un post puede estar
// realmente 'published' con post_id vacío (ej. contenido SELF_ONLY de TikTok
// no siempre trae un ID público). post_url, si está, es solo un link opcional.
const PUB_DOT_STYLES: Record<string, string> = {
  published:  'bg-emerald-400',
  failed:     'bg-rose-400',
  processing: 'bg-amber-400',
  pending:    'bg-slate-500',
};

// El polling de instagram-check-status corre cada 30s hasta 10 min — pasados
// los primeros 3 min sin confirmar, avisamos que es un procesamiento largo
// (no un error) en vez de mostrar el mismo "Publicando" genérico.
const INSTAGRAM_SLOW_PROCESSING_MS = 3 * 60 * 1000;

function isInstagramProcessingSlow(pub: Publication | undefined): boolean {
  if (!pub || pub.platform !== 'instagram' || pub.status !== 'processing') return false;
  return Date.now() - new Date(pub.created_at).getTime() > INSTAGRAM_SLOW_PROCESSING_MS;
}

interface Props {
  posts:         Post[];
  campaignId:    string;
  publications?: Publication[];
}

function isVideoFormat(format: string): boolean {
  return format === 'animated_video' || format === 'reel';
}

export function PostsList({ posts, campaignId, publications = [] }: Props) {
  const { lang, t } = useLanguage();
  const WORKFLOW_STYLES = useWorkflowStyles(t);
  const STATUS_STYLES   = useStatusStyles(t);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  const pubStatusLabel = (status: Publication['status']): string =>
    status === 'published'  ? t('posts_status_published')
    : status === 'failed'     ? t('posts_status_failed')
    : status === 'processing' ? t('posts_status_publishing')
    : t('pub_pending');

  // internal_post_id -> sus filas de publications (una por plataforma).
  const pubsByPost = new Map<string, Publication[]>();
  for (const pub of publications) {
    if (!pub.internal_post_id) continue;
    const list = pubsByPost.get(pub.internal_post_id) ?? [];
    list.push(pub);
    pubsByPost.set(pub.internal_post_id, list);
  }

  if (!posts.length) {
    return (
      <p className="text-center py-8 text-slate-600 text-sm">
        {t('posts_empty')}
      </p>
    );
  }

  return (
    <>
      <div className="divide-y divide-white/[0.04]">
        {posts.map(post => {
          const badge       = WORKFLOW_STYLES[post.workflow_status]
            ?? STATUS_STYLES[post.status]
            ?? STATUS_STYLES.draft;
          const inProgress  = IN_PROGRESS_STATUSES.has(post.workflow_status);
          const isConfirmed = post.workflow_status === 'confirmed';
          const hasMedia    = !!post.selected_visual_url;
          const platforms   = post.platforms?.length ? post.platforms : (post.platform ? [post.platform] : []);
          const isVideo     = isVideoFormat(post.format);
          const postPubs    = pubsByPost.get(post.id) ?? [];

          return (
            <div key={post.id} className="flex items-center gap-4 px-5 py-3">
              {/* Thumbnail */}
              <div
                className={`w-12 h-12 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0 overflow-hidden relative ${isConfirmed && hasMedia ? 'cursor-pointer' : ''}`}
                onClick={isConfirmed && hasMedia ? () => setPreviewPost(post) : undefined}
              >
                {hasMedia && !isVideo ? (
                  <img
                    src={`${BACKEND_BASE}${post.selected_visual_url}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : hasMedia && isVideo ? (
                  <div className="w-full h-full bg-black/60 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                    </svg>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">
                    {FORMAT_ICONS[post.format] ?? '🖼️'}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {platforms.map(p => {
                    const pub    = postPubs.find(pub => pub.platform === p);
                    // Sin publications para este post todavía (ej. delivery_mode
                    // manual, nunca confirmado) — ícono plano, sin punto de estado,
                    // no un error.
                    const dot    = postPubs.length > 0 ? PUB_DOT_STYLES[pub?.status ?? 'pending'] : null;
                    const slow   = isInstagramProcessingSlow(pub);
                    const title  = postPubs.length > 0
                      ? (slow ? t('posts_instagram_processing_slow') : `${p} — ${pubStatusLabel(pub?.status ?? 'pending')}`)
                      : p;
                    const icon   = (
                      <span title={title} className="relative inline-flex text-sm">
                        {PLATFORM_ICONS[p] ?? '🌐'}
                        {dot && (
                          <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-slate-900 ${dot}`} />
                        )}
                      </span>
                    );
                    return pub?.status === 'published' && pub.post_url ? (
                      <a key={p} href={pub.post_url} target="_blank" rel="noopener noreferrer">{icon}</a>
                    ) : (
                      <span key={p}>{icon}</span>
                    );
                  })}
                  <span className="text-xs text-slate-500">{FORMAT_ICONS[post.format]}</span>
                </div>
                {post.scheduled_date && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {new Date(post.scheduled_date).toLocaleDateString(LOCALE_MAP[lang], {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                )}
              </div>

              {/* Status badge + actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
                {inProgress && (
                  <Link
                    href={`/campaigns/${campaignId}/posts/new?postId=${post.id}`}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                  >
                    {t('step1_btn')}
                  </Link>
                )}
                {isConfirmed && hasMedia && (
                  <button
                    onClick={() => setPreviewPost(post)}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                  >
                    {t('posts_view_ad')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="relative w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewPost(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              {t('posts_close')}
            </button>
            <div className="rounded-2xl overflow-hidden bg-black border border-white/[0.08]">
              {isVideoFormat(previewPost.format) ? (
                <video
                  key={previewPost.selected_visual_url}
                  src={`${BACKEND_BASE}${previewPost.selected_visual_url}`}
                  className="w-full h-auto max-h-[85vh] object-contain"
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={`${BACKEND_BASE}${previewPost.selected_visual_url}`}
                  alt={t('posts_preview_alt')}
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
