import { dateAtNoonUtc, SOFIA_TIME_ZONE } from './dates';

/** Always with cents: `2500` → «25,00 €», `3550` → «35,50 €». */
export function formatPrice(priceCents: number): string {
  const euros = Math.floor(priceCents / 100);
  const cents = priceCents % 100;
  return `${euros},${String(cents).padStart(2, '0')} €`;
}

/** `60` → «60 мин». */
export function formatDuration(durationMin: number): string {
  return `${durationMin} мин`;
}

const timeFormat = new Intl.DateTimeFormat('bg-BG', {
  timeZone: SOFIA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const longDateFormat = new Intl.DateTimeFormat('bg-BG', {
  timeZone: SOFIA_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const rangeFormat = new Intl.DateTimeFormat('bg-BG', {
  timeZone: SOFIA_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const weekdayShortFormat = new Intl.DateTimeFormat('bg-BG', { timeZone: SOFIA_TIME_ZONE, weekday: 'short' });

/** A UTC ISO time on the Sofia clock, 24h: `2026-11-03T07:00:00.000Z` → «09:00». */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Minutes from midnight as a clock time: `540` → «09:00». */
export function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** `2026-11-03` → «вторник, 3 ноември 2026 г.» */
export function formatLongDate(date: string): string {
  return longDateFormat.format(dateAtNoonUtc(date));
}

/** Two dates as one range: `2026-11-02`, `2026-11-08` → «2 – 8 ноември 2026 г.» */
export function formatDateRange(from: string, to: string): string {
  return rangeFormat.formatRange(dateAtNoonUtc(from), dateAtNoonUtc(to));
}

/** `2026-11-03` → «вт» */
export function formatWeekdayShort(date: string): string {
  return weekdayShortFormat.format(dateAtNoonUtc(date));
}

/** `2026-11-03` → «3.11» */
export function formatDayMonth(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day}.${month}`;
}
