// Sin dependencias externas (no hay date-fns-tz/luxon/moment/dayjs instalados
// en este proyecto) — usa el Intl nativo de Node, que ya trae la base IANA.

// Mismo valor que el DEFAULT de client_profiles.timezone (migración 029).
// No debería usarse en la práctica — la columna es NOT NULL y createPost/
// updatePost solo llegan hasta acá con un JOIN a client_profiles ya resuelto
// — pero sirve de resguardo en código, no solo en la constraint de la DB.
// Importa especialmente para `timeZone: undefined`: Intl no lo rechaza, cae
// silenciosamente al timezone del proceso Node (el del servidor), no al del
// cliente — sin este fallback, ese caso agenda a la hora equivocada sin
// ningún error visible.
export const DEFAULT_TIMEZONE = 'America/New_York';

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset (ms) de `timeZone` respecto a UTC en el instante `date`, calculado
// formateando ese instante en la zona destino y comparando contra su lectura
// como UTC. Es el truco estándar para convertir sin librería — dos veces al
// año, en la hora exacta de un cambio de DST, puede haber un margen de error
// de hasta 1h; aceptable para "prográmame un post", no para relojería.
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - date.getTime();
}

/**
 * Convierte una fecha/hora "de pared" (sin offset, tal como la manda un
 * input date o datetime-local: "2026-08-25" o "2026-08-25T09:00") en el
 * timezone dado, a su instante UTC real.
 */
export function zonedTimeToUtc(localDateTime: string, timeZone: string): Date {
  const [datePart, timePart] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart ?? '00:00').split(':').map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs);
}
