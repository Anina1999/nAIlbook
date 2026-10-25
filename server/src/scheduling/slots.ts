// Free-slot calculation. Rules: .claude/skills/scheduling-engine/SKILL.md
// (calculateAvailableSlots). Pure: the caller loads the data and passes now.

import { sofiaToUtc, weekdayOf } from '../lib/time.js';
import { GRID_MIN, overlapsBooking } from './intervals.js';
import type { BookingInput, ServiceInput, WorkingHoursInput } from './types.js';

// The free start times on a Sofia date, as UTC ISO strings in ascending order.
export function calculateAvailableSlots(
  service: ServiceInput,
  date: string,
  workingHours: WorkingHoursInput[],
  daysOff: string[],
  bookings: BookingInput[],
  now: Date,
): string[] {
  if (daysOff.includes(date)) return [];

  const hours = workingHours.find((w) => w.weekday === weekdayOf(date));
  if (!hours) return [];

  const durationMs = service.durationMin * 60_000;
  const slots: string[] = [];

  // Working hours sit on the grid, so stepping from startMin keeps :00 and :30.
  for (let start = hours.startMin; start + service.durationMin <= hours.endMin; start += GRID_MIN) {
    const startAt = sofiaToUtc(date, start);
    // The same end a booking gets: the UTC start plus the duration.
    const endAt = new Date(startAt.getTime() + durationMs);

    if (overlapsBooking(startAt, endAt, bookings) || startAt <= now) continue;

    slots.push(startAt.toISOString());
  }
  return slots;
}
