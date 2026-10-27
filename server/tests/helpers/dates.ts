import { addDays, sofiaToUtc, todayInSofia, weekdayOf } from '../../src/lib/time.js';

// Dates for API tests, which run on the real clock. Never hardcode a calendar date there.

// The next date with this weekday (0 = Sunday) at least 2 days after today in
// Sofia, as "YYYY-MM-DD". The gap keeps every slot on it in the future.
export function nextWeekday(weekday: number): string {
  let date = addDays(todayInSofia(new Date()), 2);
  while (weekdayOf(date) !== weekday) date = addDays(date, 1);
  return date;
}

// A Sofia wall-clock time ("HH:MM") on a Sofia date, as a UTC ISO string.
export function slotAt(date: string, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return sofiaToUtc(date, hour * 60 + minute).toISOString();
}

// The Sofia date this many days before today, as "YYYY-MM-DD". For past bookings.
export function daysAgo(days: number): string {
  return addDays(todayInSofia(new Date()), -days);
}

// The Sofia date this many days after today, as "YYYY-MM-DD".
export function daysAhead(days: number): string {
  return addDays(todayInSofia(new Date()), days);
}

// The last Sofia date that can be booked or marked as a day off: today plus 12
// calendar months, inclusive, with a shorter month clamped (29 February becomes
// 28 February). Written out here on purpose, so API tests do not depend on
// addMonths or lastBookableDate in src/.
export function horizonEnd(): string {
  const [year, month, day] = todayInSofia(new Date()).split('-').map(Number);
  const lastDayOfTarget = new Date(Date.UTC(year, month - 1 + 13, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + 12, Math.min(day, lastDayOfTarget))).toISOString().slice(0, 10);
}

// The first date with this weekday (0 = Sunday) that is certainly beyond the
// 12-month horizon (more than 366 days ahead).
export function nextWeekdayBeyondHorizon(weekday: number): string {
  let date = daysAhead(370);
  while (weekdayOf(date) !== weekday) date = addDays(date, 1);
  return date;
}
