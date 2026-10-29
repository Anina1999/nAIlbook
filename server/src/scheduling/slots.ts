// Free-slot calculation. Rules: .claude/skills/scheduling-engine/SKILL.md
// (calculateAvailableSlots). Pure: the caller loads the data and passes now.

import { sofiaToUtc, utcToSofia, weekdayOf } from '../lib/time.js';
import { bookingEnds, GRID_MIN, lastBookableDate, overlapsBooking } from './intervals.js';
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
  // YYYY-MM-DD strings compare in date order.
  if (date > lastBookableDate(now)) return [];

  if (daysOff.includes(date)) return [];

  const hours = workingHours.find((w) => w.weekday === weekdayOf(date));
  if (!hours) return [];

  const durationMs = service.durationMin * 60_000;
  const fits = (minutes: number) => minutes + service.durationMin <= hours.endMin;

  // Candidates by instant, so a booking end on the grid is kept once.
  const candidates = new Map<number, Date>();

  // Working hours sit on the grid, so stepping from startMin keeps :00 and :30.
  for (let start = hours.startMin; fits(start); start += GRID_MIN) {
    const startAt = sofiaToUtc(date, start);
    candidates.set(startAt.getTime(), startAt);
  }

  // The end of every booking inside the working hours, as that instant.
  for (const end of bookingEnds(date, bookings)) {
    const { minutes } = utcToSofia(end);
    if (minutes >= hours.startMin && minutes < hours.endMin && fits(minutes)) {
      candidates.set(end.getTime(), end);
    }
  }

  return [...candidates.values()]
    .filter((startAt) => {
      // The same end a booking gets: the UTC start plus the duration.
      const endAt = new Date(startAt.getTime() + durationMs);
      return !overlapsBooking(startAt, endAt, bookings) && startAt > now;
    })
    .sort((a, b) => a.getTime() - b.getTime())
    .map((startAt) => startAt.toISOString());
}
