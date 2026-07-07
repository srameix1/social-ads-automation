'use client';

import { useId } from 'react';

interface IconProps {
  className?: string;
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * The SANADDS mark: gradient rounded-square background with a broadcast-signal
 * fan (three right-facing arcs from a source node) and an AI-spark lightning
 * bolt cutting through the signal. Uses useId() so multiple instances on the
 * same page each get unique SVG gradient / clipPath IDs.
 */
export function SanaddsIcon({ className = '' }: IconProps) {
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const gid  = `sng${uid}`;
  const clip = `snc${uid}`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
    >
      <defs>
        {/* Main gradient: violet → indigo → cyan */}
        <linearGradient id={gid} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#7C3AED" />
          <stop offset="50%"  stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#0891B2" />
        </linearGradient>
        {/* Clip to the rounded rect so arcs don't bleed out */}
        <clipPath id={clip}>
          <rect width="48" height="48" rx="13" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="48" height="48" rx="13" fill={`url(#${gid})`} />

      {/* Top-left highlight for perceived depth */}
      <ellipse cx="15" cy="11" rx="13" ry="7" fill="white" fillOpacity="0.1" />

      {/* Signal marks clipped to icon bounds */}
      <g clipPath={`url(#${clip})`}>
        {/* Source node */}
        <circle cx="12" cy="24" r="3.2" fill="white" />

        {/* Broadcast arc — inner (r=8) */}
        <path
          d="M12 16 A8 8 0 0 1 12 32"
          stroke="white" strokeWidth="2.6" fill="none" strokeLinecap="round"
        />
        {/* Broadcast arc — mid (r=13) */}
        <path
          d="M12 11 A13 13 0 0 1 12 37"
          stroke="white" strokeWidth="2.1" fill="none" strokeLinecap="round"
          strokeOpacity="0.55"
        />
        {/* Broadcast arc — outer (r=18) */}
        <path
          d="M12 6 A18 18 0 0 1 12 42"
          stroke="white" strokeWidth="1.7" fill="none" strokeLinecap="round"
          strokeOpacity="0.25"
        />

        {/* AI spark — lightning bolt cutting through the signal */}
        <path
          d="M28 17 L23.5 24 L28 24 L23.5 31"
          stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// ── Size maps ─────────────────────────────────────────────────────────────────

const iconSizes = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
} as const;

const textSizes = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
} as const;

/** Horizontal logo: icon left, "SAN" (violet) + "ADS" (white) right. */
export function SanaddsLogo({ size = 'md', className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <SanaddsIcon className={iconSizes[size]} />
      <span className={`font-black tracking-tight leading-none ${textSizes[size]}`}>
        <span className="text-violet-300">Spot</span>
        <span className="text-white">Flow</span>
      </span>
    </div>
  );
}

/**
 * Large centered hero — for the login left panel.
 * Icon (96px) above the wordmark with a violet glow effect and "AI Social
 * Advertising" caption in small-caps.
 */
export function SanaddsHero({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-5 ${className}`}>
      {/* Glow ring behind icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-3xl blur-2xl scale-110 opacity-60"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, #4F46E5 50%, transparent 80%)' }} />
        <SanaddsIcon className="relative w-24 h-24" />
      </div>

      <div className="text-center">
        <div className="text-[3.25rem] font-black tracking-tight leading-none select-none">
          <span className="text-violet-300">Spot</span>
          <span className="text-white">Flow</span>
        </div>
        <p className="mt-2.5 text-[10px] font-semibold tracking-[0.32em] uppercase text-slate-500">
          AI Social Advertising
        </p>
      </div>
    </div>
  );
}
