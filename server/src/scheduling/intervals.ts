import type { BookingInput } from './types.js';

// Bookings start on :00 and :30, Sofia time.
export const GRID_MIN = 30;

// True when [startAt, endAt) overlaps a BOOKED booking. Intervals overlap when
// a.start < b.end && b.start < a.end, so back-to-back bookings do not.
export function overlapsBooking(startAt: Date, endAt: Date, bookings: BookingInput[]): boolean {
  return bookings.some((b) => b.status === 'BOOKED' && startAt < b.endAt && b.startAt < endAt);
}
