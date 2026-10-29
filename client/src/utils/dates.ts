// Calendar dates as Sofia-local `YYYY-MM-DD` strings, the format the API uses.
// The browser's local date is never read: "today" comes from Intl with
// Europe/Sofia, and every other function works on the strings alone.

export const SOFIA_TIME_ZONE = 'Europe/Sofia';

/** The bookable window: today plus this many calendar months, inclusive (scheduling-engine). */
const MAX_MONTHS_AHEAD = 12;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const sofiaDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SOFIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026, 11, 3` → `2026-11-03` (month 1–12). */
function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `2026-11-03` → `{ year: 2026, month: 11, day: 3 }` (month 1–12). */
function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** The number of days in a month (1–12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The date at 12:00 UTC. Sofia is UTC+2 or UTC+3, so formatting this instant
 * in Sofia always gives the same calendar day.
 */
export function dateAtNoonUtc(date: string): Date {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** True for a real calendar date written as `YYYY-MM-DD` (`2026-02-30` is false). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** The Sofia date of an instant: `2026-10-29T22:30:00Z` → `2026-10-30`. */
export function sofiaDateOf(instant: Date): string {
  const values = Object.fromEntries(sofiaDateParts.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Today's date in Sofia, e.g. `2026-10-29`. */
export function todayInSofia(now: Date = new Date()): string {
  return sofiaDateOf(now);
}

/** The date `n` days later (negative for earlier): `2026-10-31` + 1 → `2026-11-01`. */
export function addDays(date: string, n: number): string {
  const next = dateAtNoonUtc(date);
  next.setUTCDate(next.getUTCDate() + n);
  return toIsoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/**
 * The same day of the month `n` months later; a shorter month uses its last day.
 * `2026-01-31` + 1 → `2026-02-28`, `2028-02-29` + 12 → `2029-02-28`.
 */
export function addMonths(date: string, n: number): string {
  const { year, month, day } = parts(date);
  const index = year * 12 + (month - 1) + n;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return toIsoDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** The last date that can be booked: today plus 12 calendar months, inclusive. */
export function lastBookableDate(today: string): string {
  return addMonths(today, MAX_MONTHS_AHEAD);
}

/** The weekday of a date, 0 = Sunday, as in `workingHours`. */
export function weekdayOf(date: string): number {
  return dateAtNoonUtc(date).getUTCDay();
}

/** The position of a weekday in a Monday-first week: Monday 0 … Sunday 6. */
export function mondayFirstIndex(weekday: number): number {
  return (weekday + 6) % 7;
}

/** The Monday of the week a date is in: `2026-11-08` (a Sunday) → `2026-11-02`. */
export function startOfWeek(date: string): string {
  return addDays(date, -mondayFirstIndex(weekdayOf(date)));
}

/**
 * The dates of the given weekdays (0 = Sunday) in the week that starts on
 * `monday`, Monday first: `2026-11-02`, [6, 2] → [`2026-11-03`, `2026-11-07`].
 */
export function weekDates(monday: string, weekdays: readonly number[]): string[] {
  return [...new Set(weekdays)]
    .map(mondayFirstIndex)
    .sort((a, b) => a - b)
    .map((index) => addDays(monday, index));
}
