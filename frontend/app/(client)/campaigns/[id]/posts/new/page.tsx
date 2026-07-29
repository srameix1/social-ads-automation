'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCampaign } from '@/hooks/useCampaigns';
import { useAuth } from '@/hooks/useAuth';
import { posts as postsApi, clients, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { TrialLimitModal } from '@/components/TrialLimitModal';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Strategy, VisualVariation, PostFormat, ServicePlan } from '@/lib/types';

const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

const ALL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook',  label: 'Facebook',  icon: '👥' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
];

type FormatOption = { id: PostFormat; labelKey: string; descKey: string; icon: string };

const FORMAT_OPTIONS_DEF: Record<string, FormatOption[]> = {
  basic:        [],
  professional: [
    { id: 'image',          labelKey: 'fmt_image_label', descKey: 'fmt_image_desc', icon: '🖼️' },
    { id: 'animated_video', labelKey: 'fmt_video_label', descKey: 'fmt_video_desc', icon: '🎞️' },
  ],
  premium: [
    { id: 'image',          labelKey: 'fmt_image_label', descKey: 'fmt_image_desc', icon: '🖼️' },
    { id: 'animated_video', labelKey: 'fmt_video_label', descKey: 'fmt_video_desc', icon: '🎞️' },
    { id: 'reel',           labelKey: 'fmt_reel_label',  descKey: 'fmt_reel_desc',  icon: '🎬' },
  ],
};

export default function NewPostPage() {
  const { id } = useParams<{ id: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const existingPostId = searchParams.get('postId');
  const { campaign, loading: campLoading } = useCampaign(id);
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  // Plan / reel quota
  const [plan,           setPlan]           = useState<ServicePlan>('basic');
  const [reelUsed,       setReelUsed]       = useState(0);
  const [reelQuota,      setReelQuota]      = useState(8);
  const [profileLoading, setProfileLoading] = useState(true);

  // Trial
  const [isTrial,          setIsTrial]          = useState(false);
  const [trialPostsUsed,   setTrialPostsUsed]   = useState(0);
  const [trialPostsLimit,  setTrialPostsLimit]  = useState(0);
  const [trialLimitReached, setTrialLimitReached] = useState(false);

  // Wizard state
  const [step,              setStep]              = useState(0);
  const [postId,            setPostId]            = useState<string | null>(null);
  const [format,            setFormat]            = useState<PostFormat | ''>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledDate,     setScheduledDate]     = useState('');

  // Step 1: post-specific focus
  const [postFocus, setPostFocus] = useState('');

  // Attempt limits (real, backend-enforced — closes the "Anterior" wizard loophole)
  const [maxCopyAttempts,   setMaxCopyAttempts]   = useState(5);
  const [maxVisualAttempts, setMaxVisualAttempts] = useState(2);
  const [copyAttemptsUsed,   setCopyAttemptsUsed]   = useState(0);
  const [visualAttemptsUsed, setVisualAttemptsUsed] = useState(0);

  // Step 2: copy options
  const [strategies,        setStrategies]        = useState<Strategy[]>([]);
  const [selectedStrategy,  setSelectedStrategy]  = useState<Strategy | null>(null);
  const [photos,            setPhotos]            = useState<File[]>([]);

  // Step 3: visual variations
  const [variations,        setVariations]        = useState<VisualVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<VisualVariation | null>(null);
  const [workflowStatus,    setWorkflowStatus]    = useState('');

  // Overlay options (step 3, sent at confirm)
  const [overlayLogo, setOverlayLogo] = useState(false);
  const [overlayCopy, setOverlayCopy] = useState(false);

  // UI state
  const [generating,        setGenerating]        = useState(false);
  const [submitting,        setSubmitting]        = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [error,             setError]             = useState('');
  const pollingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoGenStartRef = useRef<number | null>(null);

  const VIDEO_POLL_TIMEOUT_MS = 25 * 60 * 1000;

  useEffect(() => {
    Promise.allSettled([clients.getProfile(), clients.getReelUsage(), clients.getAttemptLimits()] as const)
      .then(([profileResult, reelResult, attemptLimitsResult]) => {
        if (profileResult.status === 'fulfilled') {
          const profile = profileResult.value.profile;
          const clientPlan = profile.plan ?? 'basic';
          setPlan(clientPlan);
          if (clientPlan === 'basic') setFormat('image');
          setIsTrial(profile.is_trial ?? false);
          setTrialPostsUsed(profile.posts_used ?? 0);
          setTrialPostsLimit(profile.trial_posts_limit ?? 0);
        }
        if (reelResult.status === 'fulfilled') {
          setReelUsed(reelResult.value.used);
          setReelQuota(reelResult.value.quota);
        }
        if (attemptLimitsResult.status === 'fulfilled') {
          setMaxCopyAttempts(attemptLimitsResult.value.maxCopyAttempts);
          setMaxVisualAttempts(attemptLimitsResult.value.maxVisualAttempts);
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    if (!existingPostId) return;
    postsApi.getPost(existingPostId)
      .then(({ post }) => {
        setPostId(existingPostId);
        setWorkflowStatus(post.workflow_status);
        setCopyAttemptsUsed(post.copy_generation_attempts ?? 0);
        setVisualAttemptsUsed(post.visual_generation_attempts ?? 0);
        if (post.variations?.length) {
          setVariations(post.variations.filter(v => v.url));
        }
        const targetStep = (() => {
          switch (post.workflow_status) {
            case 'draft':           return 0;
            case 'described':       return 1;
            case 'generating_copy':
            case 'copy_ready':      return 2;
            case 'generating_visuals':
            case 'visuals_ready':
            case 'visuals_failed':  return 3;
            case 'visual_selected':
            case 'generating_video':
            case 'confirmed':       return 4;
            default:                return 0;
          }
        })();
        setStep(targetStep);
      })
      .catch(() => { /* leave step=0 as fallback */ });
  }, [existingPostId]);

  useEffect(() => {
    if (step !== 3 || !postId) return;
    if (workflowStatus === 'visuals_ready' || workflowStatus === 'visuals_failed') return;
    if (workflowStatus === 'visual_selected') return;

    let cancelled = false;

    const doCheck = async () => {
      try {
        const { post } = await postsApi.getPost(postId);
        if (cancelled) return;
        setWorkflowStatus(post.workflow_status);
        setVisualAttemptsUsed(post.visual_generation_attempts ?? 0);

        if (post.workflow_status === 'generating_video') {
          setIsGeneratingVideo(true);
        }

        if (
          post.workflow_status === 'generating_video' &&
          videoGenStartRef.current !== null &&
          Date.now() - videoGenStartRef.current > VIDEO_POLL_TIMEOUT_MS
        ) {
          clearInterval(pollingRef.current!);
          pollingRef.current       = null;
          videoGenStartRef.current = null;
          setGenerating(false);
          setSubmitting(false);
          setIsGeneratingVideo(false);
          setWorkflowStatus('visuals_ready');
          setError(t('post_timeout_error'));
          return;
        }

        if (post.workflow_status === 'visuals_ready') {
          setVariations(post.variations.filter(v => v.url));
          setGenerating(false);
        } else if (post.workflow_status === 'visuals_failed') {
          setGenerating(false);
          setSubmitting(false);
          setIsGeneratingVideo(false);
          videoGenStartRef.current = null;
          setError(
            post.error_message
              ? `Error: ${post.error_message}`
              : t('post_visuals_error'),
          );
        } else if (post.workflow_status === 'visual_selected') {
          const freshVariation = post.variations.find(v => v.selected);
          if (freshVariation) setSelectedVariation(freshVariation);
          videoGenStartRef.current = null;
          setIsGeneratingVideo(false);
          setGenerating(false);
          setStep(4);
        }
      } catch (err) {
        console.error('[NewPostPage] Polling error:', err);
      }
    };

    // Start interval first so pollingRef is set before doCheck can clear it
    pollingRef.current = setInterval(doCheck, 3000);
    doCheck(); // immediate check — shows video instantly if already ready

    return () => { cancelled = true; if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [step, postId, workflowStatus]);

  const loading = campLoading || profileLoading;

  if (loading) return <PageLoader />;
  if (!campaign) return (
    <div className="text-center py-20 text-slate-500">
      <p>{t('post_not_found')}</p>
      <Link href="/campaigns" className="text-brand-400 text-sm mt-2 block">← {t('camp_back')}</Link>
    </div>
  );

  const formatOptions = FORMAT_OPTIONS_DEF[plan] ?? [];
  const needsFormat   = formatOptions.length > 0;
  const reelAtLimit   = reelUsed >= reelQuota;
  const effectiveFormat: PostFormat = (format || 'image') as PostFormat;
  const copyAttemptsLeft   = Math.max(maxCopyAttempts   - copyAttemptsUsed,   0);
  const visualAttemptsLeft = Math.max(maxVisualAttempts - visualAttemptsUsed, 0);
  const visualAttemptsAtLimit = visualAttemptsLeft <= 0;

  const STEP_LABELS = [
    t('post_step_config'),
    t('post_step_describe'),
    t('post_step_copy'),
    t('post_step_visual'),
    t('post_step_confirm'),
    t('post_step_done'),
  ];

  const FORMAT_LABELS: Record<PostFormat, string> = {
    image:          t('fmt_image_label'),
    animated_video: t('fmt_video_label'),
    reel:           t('fmt_reel_label'),
  };

  const canProceed = [
    selectedPlatforms.length > 0 && (!needsFormat || !!format),
    postFocus.trim().length > 0,
    !!selectedStrategy,
    !!selectedVariation,
    true,
  ][step] ?? false;

  const togglePlatform = (pid: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid],
    );
  };

  const handleCreatePost = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { post } = await postsApi.create(id, {
        platforms:      selectedPlatforms,
        format:         effectiveFormat,
        scheduled_date: scheduledDate || undefined,
      });
      setPostId(post.id);
      setStep(1);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TRIAL_LIMIT_REACHED') {
        setTrialLimitReached(true);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!postId) return;
    setGenerating(true);
    setError('');
    try {
      await postsApi.updateDescription(postId, { post_focus: postFocus });
      const { post, strategies: s } = await postsApi.generateCopy(postId, lang);
      setStrategies(s);
      setCopyAttemptsUsed(post.copy_generation_attempts ?? 0);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateCopy = async () => {
    if (!postId || copyAttemptsLeft <= 0) return;
    setGenerating(true);
    setError('');
    try {
      const { post, strategies: s } = await postsApi.generateCopy(postId, lang);
      setStrategies(s);
      setSelectedStrategy(null);
      setCopyAttemptsUsed(post.copy_generation_attempts ?? 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectCopy = async () => {
    if (!postId || !selectedStrategy || visualAttemptsAtLimit) return;
    setGenerating(true);
    setError('');
    try {
      const { post } = photos.length
        ? await postsApi.selectCopyWithPhotos(postId, selectedStrategy.id, photos)
        : await postsApi.selectCopy(postId, selectedStrategy.id);
      setVisualAttemptsUsed(post.visual_generation_attempts ?? 0);
      setWorkflowStatus('generating_visuals');
      setVariations([]);
      setSelectedVariation(null);
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
      setGenerating(false);
    }
  };

  const handleSelectVisual = async () => {
    if (!postId || !selectedVariation) return;
    setSubmitting(true);
    setError('');
    try {
      const { post } = await postsApi.selectVisual(postId, selectedVariation.id);
      if (post.workflow_status === 'generating_video') {
        videoGenStartRef.current = Date.now();
        setWorkflowStatus('generating_video');
        setIsGeneratingVideo(true);
      } else {
        setStep(4);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!postId) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await postsApi.confirm(postId, { overlay_logo: overlayLogo, overlay_copy: overlayCopy });
      const { variationUrl } = result;
      if (variationUrl && selectedVariation) {
        setSelectedVariation({ ...selectedVariation, url: variationUrl });
      }
      setStep(5);
      setSubmitting(false);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos(prev => [...prev, ...files].slice(0, 4));
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {trialLimitReached && (
        <TrialLimitModal email={user?.email ?? ''} onClose={() => setTrialLimitReached(false)} />
      )}

      {/* Header */}
      <div>
        <Link href={`/campaigns/${id}`} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {campaign.title}
        </Link>
        <h1 className="text-2xl font-bold text-white">{t('post_new_title')}</h1>
      </div>

      {isTrial && !trialLimitReached && (
        <div className="px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">
          {t('trial_posts_left', Math.max(trialPostsLimit - trialPostsUsed, 0))}
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const allDone  = step === 5;
          const done     = allDone || i < step;
          const active   = !allDone && i === step;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${done || active ? 'text-brand-400' : 'text-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold border ${
                  done   ? 'bg-brand-500 border-brand-500 text-white' :
                  active ? 'border-brand-500 text-brand-400' :
                           'border-white/[0.1] text-slate-600'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className="text-xs hidden sm:block">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-6 ${done ? 'bg-brand-500' : 'bg-white/[0.08]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="surface rounded-xl p-6">

        {/* ── Step 0: Configure ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">{t('post_step0_title')}</h2>
              <span className="text-xs font-mono text-slate-600 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded">
                plan: <span className="text-brand-400">{plan}</span>
              </span>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">{t('post_content_type')}</p>
              {needsFormat ? (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {formatOptions.map(opt => {
                      const disabled = opt.id === 'reel' && reelAtLimit;
                      const active   = format === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && setFormat(opt.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            active    ? 'border-brand-500/50 bg-brand-500/15 text-brand-300' :
                            disabled  ? 'border-white/[0.05] text-slate-700 cursor-not-allowed' :
                                        'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.18]'
                          }`}
                          title={disabled ? t('post_reel_limit', reelUsed, reelQuota) : t(opt.descKey)}
                        >
                          <span>{opt.icon}</span>{t(opt.labelKey)}
                          {active && (
                            <svg className="w-3 h-3 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {plan === 'premium' && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${reelAtLimit ? 'bg-rose-500' : 'bg-violet-500'}`}
                          style={{ width: `${Math.min((reelUsed / reelQuota) * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs ${reelAtLimit ? 'text-rose-400' : 'text-slate-500'}`}>
                        {t('post_reel_used', reelUsed, reelQuota)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                  <span>🖼️</span>
                  <span>{t('post_basic_only')}</span>
                </div>
              )}
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">{t('form_camp_platforms')}</p>
              <div className="flex gap-3 flex-wrap">
                {ALL_PLATFORMS.filter(p => campaign.platforms.includes(p.id)).map(p => {
                  const active = selectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                          : 'border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/[0.15]'
                      }`}
                    >
                      <span className="text-lg">{p.icon}</span>{p.label}
                      {active && (
                        <svg className="w-3.5 h-3.5 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">{t('post_date_label')}</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500/60"
              />
            </div>
          </div>
        )}

        {/* ── Step 1: Describe ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">{t('post_step1_title')}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('post_step1_sub')}</p>
            </div>

            {campaign.business_problem && (
              <div className="p-3 rounded-xl border border-brand-500/20 bg-brand-500/5 space-y-1.5">
                <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider">
                  {t('post_context_label')}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {campaign.business_problem}
                </p>
                {campaign.differentiator && (
                  <p className="text-xs text-slate-500">
                    <span className="text-slate-600">{t('post_diff_label')}</span> {campaign.differentiator}
                  </p>
                )}
              </div>
            )}

            <Textarea
              label={t('post_focus_label')}
              value={postFocus}
              onChange={e => setPostFocus(e.target.value)}
              placeholder={t('post_focus_ph')}
              rows={4}
            />
          </div>
        )}

        {/* ── Step 2: Choose copy ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">{t('post_step2_title')}</h2>
            {strategies.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">{t('post_no_strategies')}</p>
            ) : (
              <div className="space-y-3">
                {strategies.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStrategy(s)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedStrategy?.id === s.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-white/[0.08] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 mb-1">{s.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
                        {selectedStrategy?.id === s.id && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06]">
                            <p className="text-xs text-slate-400 italic line-clamp-3">&ldquo;{s.copy_text}&rdquo;</p>
                          </div>
                        )}
                      </div>
                      {selectedStrategy?.id === s.id && (
                        <div className="w-5 h-5 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Regen counter + action buttons */}
            <div className="flex flex-col items-center gap-3 pt-1">
              <p className="text-xs text-slate-600">{t('post_regen_left', copyAttemptsLeft, maxCopyAttempts)}</p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={generating}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 hover:border-white/[0.18] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                  {t('post_change_focus')}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateCopy}
                  disabled={copyAttemptsLeft <= 0 || generating}
                  title={copyAttemptsLeft <= 0 ? t('post_regen_limit') : undefined}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 hover:border-white/[0.18] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  {generating ? t('post_generating') : t('post_regen_copy')}
                </button>
              </div>
            </div>

            {selectedStrategy && (
              <div className={`text-center text-xs rounded-xl px-3 py-2 border ${
                visualAttemptsLeft === 1
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-300'
                  : visualAttemptsAtLimit
                    ? 'border-rose-500/30 bg-rose-500/5 text-rose-400'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-500'
              }`}>
                {visualAttemptsAtLimit
                  ? t('post_visual_limit_reached', maxVisualAttempts)
                  : visualAttemptsLeft === 1
                    ? t('post_visual_last_attempt')
                    : t('post_visual_attempts_left', visualAttemptsLeft, maxVisualAttempts)}
              </div>
            )}

            {selectedStrategy && (
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-400 mb-2">{t('post_photos_label')}</p>
                <p className="text-xs text-slate-600 mb-3">{t('post_photos_sub')}</p>
                <label className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl border border-dashed border-white/[0.12] hover:border-brand-500/40 hover:bg-brand-500/5 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                  </svg>
                  <span className="text-xs text-slate-500">
                    {photos.length ? t('post_photos_count', photos.length) : t('post_upload_label')}
                  </span>
                </label>
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPhotos([])}
                    className="mt-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    {t('post_remove_photos')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Choose visual ────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-slate-200">{t('post_step3_title')}</h2>

            {(workflowStatus === 'generating_visuals' && generating) && (
              <div className="flex items-center gap-3 p-5 rounded-xl border border-brand-500/20 bg-brand-500/5">
                <Spinner size="sm" className="text-brand-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-brand-300 font-medium">{t('post_gen_visuals_msg')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('post_gen_visuals_sub')}</p>
                </div>
              </div>
            )}

            {workflowStatus === 'generating_video' && (
              <div className="flex items-center gap-3 p-5 rounded-xl border border-violet-500/20 bg-violet-500/5">
                <Spinner size="sm" className="text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-violet-300 font-medium">
                    {effectiveFormat === 'reel' ? t('post_gen_reel_msg') : t('post_gen_video_msg')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('post_gen_video_sub')}</p>
                </div>
              </div>
            )}

            {variations.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {variations.map(v => {
                    const imgUrl   = `${BACKEND_BASE}${v.url}`;
                    const isChosen = selectedVariation?.id === v.id;
                    return (
                      <div key={v.id} className="relative w-full">
                        <button
                          onClick={() => setSelectedVariation(v)}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square w-full block ${
                            isChosen ? 'border-brand-500' : 'border-transparent hover:border-white/20'
                          }`}
                        >
                          <img src={imgUrl} alt={`Visual ${v.position}`} className="w-full h-full object-cover" />
                          {isChosen && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                              </svg>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                              {t('post_visual_n', v.position)}
                            </span>
                          </div>
                        </button>
                        <a
                          href={imgUrl}
                          download={`variacion-${v.position}.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-colors"
                          title="Descargar imagen"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                          </svg>
                        </a>
                      </div>
                    );
                  })}
                </div>

              </>
            )}

            {workflowStatus === 'visuals_failed' && (
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-400">
                {t('post_visuals_error')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setWorkflowStatus('copy_ready');
                    setGenerating(false);
                  }}
                  className="underline hover:text-rose-300"
                >
                  {t('post_retry')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Confirm ────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-slate-200">{t('post_step4_title')}</h2>

            {selectedVariation?.url ? (
              <div className="space-y-2">
                <div className="w-full rounded-xl overflow-hidden border border-white/[0.08] bg-black flex items-center justify-center">
                  {selectedVariation.type === 'video' ? (
                    <video
                      key={selectedVariation.url}
                      src={`${BACKEND_BASE}${selectedVariation.url}`}
                      className="w-full h-auto max-h-[65vh] object-contain"
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={`${BACKEND_BASE}${selectedVariation.url}`}
                      alt="Visual del anuncio"
                      className="w-full h-auto max-h-[65vh] object-contain"
                    />
                  )}
                </div>
                <a
                  href={`${BACKEND_BASE}${selectedVariation.url}`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 hover:border-white/[0.18] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  {t('post_download_media')}
                </a>
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-slate-600 text-sm">
                {t('post_no_preview')}
              </div>
            )}

            {selectedStrategy?.copy_text && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{t('post_copy_label')}</p>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{selectedStrategy.copy_text}</p>
              </div>
            )}

            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">{t('form_camp_platforms')}</span>
                <span className="text-sm text-slate-200">{selectedPlatforms.join(', ')}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">{t('post_format_detail')}</span>
                <span className="text-sm text-slate-200">{FORMAT_LABELS[effectiveFormat]}</span>
              </div>
              {scheduledDate && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">{t('post_publication')}</span>
                  <span className="text-sm text-slate-200">
                    {new Date(scheduledDate + 'T12:00:00').toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {selectedStrategy?.title && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">{t('post_strategy_detail')}</span>
                  <span className="text-sm text-slate-200 max-w-[200px] text-right truncate">{selectedStrategy.title}</span>
                </div>
              )}
            </div>

            {selectedVariation?.type === 'video' && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                <p className="text-xs font-medium text-slate-400">{t('post_overlay_title')}</p>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setOverlayLogo(v => !v)}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${overlayLogo ? 'bg-brand-500' : 'bg-white/[0.1]'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${overlayLogo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">{t('post_overlay_logo')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setOverlayCopy(v => !v)}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${overlayCopy ? 'bg-brand-500' : 'bg-white/[0.1]'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${overlayCopy ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">{t('post_overlay_copy')}</span>
                </label>
              </div>
            )}

          </div>
        )}

        {/* ── Step 5: Final review ──────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-5">
            {/* Success header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-white">{t('post_done_title')}</h2>
            </div>

            {/* Final video or image */}
            {selectedVariation?.url ? (
              <div className="space-y-2">
                <div className="w-full rounded-xl overflow-hidden border border-white/[0.08] bg-black flex items-center justify-center">
                  {selectedVariation.type === 'video' ? (
                    <video
                      key={selectedVariation.url}
                      src={`${BACKEND_BASE}${selectedVariation.url}`}
                      className="w-full h-auto max-h-[65vh] object-contain"
                      controls autoPlay muted loop playsInline
                    />
                  ) : (
                    <img
                      src={`${BACKEND_BASE}${selectedVariation.url}`}
                      alt="Anuncio final"
                      className="w-full h-auto max-h-[65vh] object-contain"
                    />
                  )}
                </div>
                <a
                  href={`${BACKEND_BASE}${selectedVariation.url}`}
                  download target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 hover:border-white/[0.18] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  {t('post_download_media')}
                </a>
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-slate-600 text-sm">
                {t('post_no_preview')}
              </div>
            )}

            {/* Copy text */}
            {selectedStrategy?.copy_text && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{t('post_copy_label')}</p>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{selectedStrategy.copy_text}</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-400">
            {error}
          </div>
        )}
      </div>

      {/* Navigation */}
      {step === 5 ? (
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => router.push(`/campaigns/${id}`)}>
            {t('post_done_another')}
          </Button>
          <Button className="flex-1" onClick={() => router.push(`/campaigns/${id}`)}>
            {t('post_done_publish')}
          </Button>
        </div>
      ) : (
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === 0) router.push(`/campaigns/${id}`);
            else if (step === 4) { setStep(3); setWorkflowStatus('visuals_ready'); }
            else setStep(s => s - 1);
          }}
          disabled={generating || submitting || isGeneratingVideo || (step === 3 && (workflowStatus === 'generating_visuals' || workflowStatus === 'generating_video'))}
        >
          {step === 0 ? t('post_cancel') : step === 4 ? t('post_back_choose') : t('form_camp_prev')}
        </Button>

        {step === 0 && (
          <Button onClick={handleCreatePost} loading={submitting} disabled={!canProceed}>
            {t('form_camp_next')}
          </Button>
        )}
        {step === 1 && (
          <Button onClick={handleGenerateCopy} loading={generating} disabled={!canProceed}>
            {generating ? t('post_generating') : t('post_gen_copy_btn')}
          </Button>
        )}
        {step === 2 && (
          <Button onClick={handleSelectCopy} loading={generating} disabled={!canProceed || visualAttemptsAtLimit}>
            {generating ? t('post_sending') : t('post_gen_visuals_btn')}
          </Button>
        )}
        {step === 3 && (
          <Button
            onClick={handleSelectVisual}
            loading={submitting || isGeneratingVideo}
            disabled={!canProceed || workflowStatus === 'generating_visuals' || workflowStatus === 'generating_video' || isGeneratingVideo}
          >
            {isGeneratingVideo
              ? t('post_generating')
              : effectiveFormat === 'image' ? t('form_camp_next') : t('post_gen_video_btn')}
          </Button>
        )}
        {step === 4 && (
          <Button onClick={handleConfirm} loading={submitting}>
            {t('post_confirm_btn')}
          </Button>
        )}
      </div>
      )}
    </div>
  );
}
