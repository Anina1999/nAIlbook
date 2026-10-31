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

/** Two UTC ISO times as one range on the Sofia clock: «11:00–12:30». */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`;
}

/** Who cancelled a booking, for the client: `'CLIENT'` → «Отменен от вас.» */
export function formatCancelledBy(cancelledBy: 'CLIENT' | 'MANICURIST' | null): string {
  return cancelledBy === 'MANICURIST' ? 'Отменен от маникюриста.' : 'Отменен от вас.';
}

/** The bookings of a week: `0` → «Няма часове през тази седмица.», `1` → «1 час през седмицата», `3` → «3 часа през седмицата». */
export function formatWeekBookingCount(count: number): string {
  if (count === 0) return 'Няма часове през тази седмица.';
  return `${count} ${count === 1 ? 'час' : 'часа'} през седмицата`;
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

/** The first letters of the first two words, for an avatar: «Мария Петрова» → «МП». */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toLocaleUpperCase('bg-BG'))
    .join('');
}
