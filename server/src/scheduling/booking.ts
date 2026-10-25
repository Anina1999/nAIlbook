// Booking validation and cancel rules. Rules: .claude/skills/scheduling-engine/SKILL.md
// (validateBooking, Cancel). Pure: the caller loads the data and passes now.

import type { ErrorCode } from '../lib/errors.js';
import { sofiaToUtc, utcToSofia, weekdayOf } from '../lib/time.js';
import { GRID_MIN, overlapsBooking } from './intervals.js';
import type {
  CancellableBooking,
  CancelledBy,
  CheckFailure,
  CheckResult,
  ValidateBookingInput,
} from './types.js';

function fail(code: ErrorCode, message: string): CheckFailure {
  return { ok: false, code, message };
}

// Re-checks a requested start and returns the first failure in the skill's
// order. On success, endAt is computed here; the client never sends it.
export function validateBooking(input: ValidateBookingInput): CheckResult<{ endAt: Date }> {
  const { manicuristId, service, startAt, workingHours, daysOff, bookings, now } = input;

  if (!service || service.manicuristId !== manicuristId) {
    return fail('NOT_FOUND', 'Услугата не е намерена.');
  }

  const { date, minutes } = utcToSofia(startAt);
  if (daysOff.includes(date)) {
    return fail('DAY_OFF', 'Маникюристът не работи в този ден. Изберете друга дата.');
  }

  // The round trip rejects seconds and the second occurrence of a repeated
  // local hour, which calculateAvailableSlots never offers.
  const onGrid = minutes % GRID_MIN === 0 && sofiaToUtc(date, minutes).getTime() === startAt.getTime();
  const hours = workingHours.find((w) => w.weekday === weekdayOf(date));
  const fits = hours && minutes >= hours.startMin && minutes + service.durationMin <= hours.endMin;
  if (!onGrid || !fits) {
    return fail('SLOT_INVALID', 'Този час е извън работното време. Изберете свободен час.');
  }

  if (startAt <= now) {
    return fail('SLOT_INVALID', 'Този час вече е минал. Изберете друг час.');
  }

  const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);
  if (overlapsBooking(startAt, endAt, bookings)) {
    return fail('SLOT_TAKEN', 'Този час вече е зает. Изберете друг свободен час.');
  }

  return { ok: true, endAt };
}

// Who may cancel is checked before the booking's state, so a stranger learns
// nothing about it. The reason for the cancel is validated by the route.
export function canCancel(
  booking: CancellableBooking,
  userId: number,
  now: Date,
): CheckResult<{ cancelledBy: CancelledBy }> {
  const cancelledBy: CancelledBy | null =
    userId === booking.clientId ? 'CLIENT' : userId === booking.manicuristId ? 'MANICURIST' : null;
  if (!cancelledBy) {
    return fail('FORBIDDEN', 'Можете да откажете само свой час.');
  }

  if (booking.status !== 'BOOKED' || booking.startAt <= now) {
    return fail('NOT_CANCELLABLE', 'Този час вече е отказан или е минал.');
  }

  return { ok: true, cancelledBy };
}
