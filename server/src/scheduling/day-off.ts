// Day-off check. Rules: .claude/skills/scheduling-engine/SKILL.md (Days off).
// Pure: the caller loads the active days off (deletedAt: null) and passes now.

import { todayInSofia, utcToSofia } from '../lib/time.js';
import type { BookingInput, CheckResult } from './types.js';

// Checks in the skill's order: the date, an active day off, then bookings.
// The bookings on that Sofia date come back as they were passed, so the
// route keeps their id, service and client for the "Days off" screen.
export function canMarkDayOff<T extends BookingInput>(
  date: string,
  daysOff: string[],
  bookings: T[],
  now: Date,
): CheckResult<object, { bookings: T[] }> {
  // YYYY-MM-DD strings compare in date order.
  if (date < todayInSofia(now)) {
    return { ok: false, code: 'SLOT_INVALID', message: 'Изберете днешна или бъдеща дата.' };
  }

  if (daysOff.includes(date)) {
    return { ok: false, code: 'ALREADY_DAY_OFF', message: 'Тази дата вече е почивен ден.' };
  }

  const onDate = bookings.filter((b) => b.status === 'BOOKED' && utcToSofia(b.startAt).date === date);
  if (onDate.length > 0) {
    return {
      ok: false,
      code: 'DAY_HAS_BOOKINGS',
      message: 'На тази дата има запазени часове. Откажете ги, преди да отбележите деня като почивен.',
      details: { bookings: onDate },
    };
  }

  return { ok: true };
}
