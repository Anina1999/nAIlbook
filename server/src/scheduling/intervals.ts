import { addMonths, todayInSofia } from '../lib/time.js';
import type { BookingInput } from './types.js';

// Bookings start on :00 and :30, Sofia time.
export const GRID_MIN = 30;

// How far ahead a booking or a day off is allowed, in calendar months.
export const MAX_MONTHS_AHEAD = 12;

// The last Sofia date that can be booked or marked as a day off: today in
// Sofia plus MAX_MONTHS_AHEAD months, inclusive.
export function lastBookableDate(now: Date): string {
  return addMonths(todayInSofia(now), MAX_MONTHS_AHEAD);
}

// True when [startAt, endAt) overlaps a BOOKED booking. Intervals overlap when
// a.start < b.end && b.start < a.end, so back-to-back bookings do not.
export function overlapsBooking(startAt: Date, endAt: Date, bookings: BookingInput[]): boolean {
  return bookings.some((b) => b.status === 'BOOKED' && startAt < b.endAt && b.startAt < endAt);
}
