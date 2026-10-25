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
