'use client';

import Link from 'next/link';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { SanaddsLogo } from '@/components/ui/Logo';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Public landing — deliberately NOT a generic corporate template.
 *
 * Bold, image-led hero: a collage of AI-style example posts (labelled as
 * examples, never as real results) collides with oversized type. The copy
 * stays in plain language for owners who do not know ads, states plainly
 * that SpotFlow publishes organic posts (no paid ads, no ad budget), and
 * never promises sales, reach or any guaranteed result.
 *
 * Lives outside (client)/ so it is reachable without a session. /login
 * is untouched.
 */
function PostCard({
  gradient, caption, rotate, badge,
}: {
  gradient: string;
  caption: string;
  rotate: string;
  badge: string;
}) {
  return (
    <article
      className={`relative w-44 shrink-0 overflow-hidden rounded-3xl border border-white/20 shadow-2xl shadow-black/60 sm:w-52 ${rotate}`}
    >
      <div className={`relative h-44 sm:h-52 ${gradient}`}>
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white">
          {badge}
        </span>
        {/* Abstract AI-image shapes — no fake photo, no fake result. */}
        <div className="absolute -bottom-6 -right-4 h-28 w-28 rounded-full bg-white/20" />
        <div className="absolute bottom-10 left-4 h-10 w-10 rounded-full bg-black/20" />
        <div className="absolute right-5 top-14 h-16 w-3 rotate-12 rounded-full bg-white/30" />
      </div>
      <div className="bg-slate-950/95 px-3 py-3">
        <p className="text-xs font-semibold leading-snug text-white">{caption}</p>
        <p className="mt-1 text-[11px] text-slate-400">SpotFlow · Instagram / Facebook / TikTok</p>
      </div>
    </article>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();

  const steps = [
    { n: '01', title: t('landing_step1_title'), text: t('landing_step1_text') },
    { n: '02', title: t('landing_step2_title'), text: t('landing_step2_text') },
    { n: '03', title: t('landing_step3_title'), text: t('landing_step3_text') },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#06060f] text-slate-200">
      {/* Ambient colour, behind everything */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <SanaddsLogo size="sm" />
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <Link
            href="/login"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t('landing_nav_login')}
          </Link>
        </div>
      </header>

      <main className="relative">
        {/* ── HERO: type crashing into an AI-post collage ─────────────── */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-12">
          <div>
            <p className="inline-block rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300">
              {t('landing_kicker')}
            </p>
            <h1 className="mt-5 text-[2.6rem] font-black leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {t('landing_hero_title')}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
              {t('landing_hero_sub')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
              >
                {t('landing_cta_register')} →
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t('landing_cta_login')}
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">{t('landing_visual_note')}</p>
          </div>

          {/* Collage — visible on mobile too, stacked under the headline. */}
          <div className="relative mx-auto flex w-full max-w-md flex-wrap justify-center gap-3 py-4 sm:gap-4 lg:max-w-none">
            <PostCard
              gradient="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
              caption={t('landing_card_bakery')}
              rotate="-rotate-6"
              badge="IA ✦"
            />
            <PostCard
              gradient="bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600"
              caption={t('landing_card_barber')}
              rotate="rotate-3 translate-y-4"
              badge="IA ✦"
            />
            <PostCard
              gradient="bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-700"
              caption={t('landing_card_boutique')}
              rotate="-rotate-2"
              badge="IA ✦"
            />
          </div>
        </section>

        {/* ── Platform strip ─────────────────────────────────────────── */}
        <div className="border-y border-white/10 bg-white/[0.03] py-3">
          <p className="text-center text-sm font-bold tracking-[0.25em] text-slate-300">
            INSTAGRAM ✦ FACEBOOK ✦ TIKTOK ✦ {t('landing_organic_title')}
          </p>
        </div>

        {/* ── Steps: big numbers, no card-template grid ─────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-black text-white sm:text-4xl">{t('landing_how_title')}</h2>
          <div className="mt-8 space-y-6">
            {steps.map(step => (
              <div key={step.n} className="flex flex-col gap-2 border-b border-white/10 pb-6 sm:flex-row sm:items-baseline sm:gap-8">
                <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-5xl font-black text-transparent">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Example + organic vs paid, as a contrast ──────────────── */}
        <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-14 sm:px-6 lg:grid-cols-2">
          <article className="rounded-[2rem] bg-gradient-to-br from-amber-400/20 via-orange-500/10 to-transparent p-6 ring-1 ring-white/10 sm:p-8">
            <h2 className="text-2xl font-black text-white">{t('landing_example_title')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('landing_example_text')}</p>
            <p className="mt-4 text-xs text-slate-500">{t('landing_example_caption')}</p>
          </article>
          <article className="rounded-[2rem] bg-slate-900/80 p-6 ring-1 ring-white/10 sm:p-8">
            <h2 className="text-2xl font-black text-white">{t('landing_organic_title')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('landing_organic_text')}</p>
            <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
              ✓ {t('landing_organic_paid')}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{t('landing_organic_note')}</p>
          </article>
        </section>

        {/* ── Free start: loud, not a small card ─────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-6 py-10 text-center sm:py-14">
            <h2 className="text-3xl font-black text-white sm:text-5xl">{t('landing_free_title')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              {t('landing_free_text')}
            </p>
            <Link
              href="/register"
              className="mt-7 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-black text-slate-950 hover:bg-slate-100"
            >
              {t('landing_nav_register')} →
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <span>{t('landing_footer_note')}</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms</Link>
            <Link href="/login" className="hover:text-slate-300">{t('landing_nav_login')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
