'use client';

import { useMemo } from 'react';

// Fallback para navegadores sin Intl.supportedValuesOf('timeZone') (Safari <
// 15.4) — no hace falta una librería nueva, alcanza con un puñado de zonas
// comunes; el resto de los navegadores recibe la lista IANA completa.
const FALLBACK_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
  'America/Buenos_Aires', 'America/Sao_Paulo', 'Europe/Madrid', 'Europe/London',
  'UTC',
];

function getSupportedTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    try { return Intl.supportedValuesOf('timeZone'); } catch { /* cae al fallback */ }
  }
  return FALLBACK_TIMEZONES;
}

interface Props {
  value:    string;
  onChange: (tz: string) => void;
  label?:   string;
}

export function TimezoneSelect({ value, onChange, label }: Props) {
  const zones = useMemo(getSupportedTimeZones, []);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-100 bg-dark-700 border border-white/[0.08] focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/40 transition-colors duration-150"
      >
        {zones.map(tz => (
          <option key={tz} value={tz}>{tz}</option>
        ))}
      </select>
    </div>
  );
}
