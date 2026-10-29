import { addMonths, todayInSofia, utcToSofia } from '../lib/time.js';
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

// The ends of the BOOKED bookings that fall on this Sofia date, as UTC
// instants. Each one is a start besides the grid, so a day can be booked
// without gaps. The instant itself is used, never rebuilt from its local time.
export function bookingEnds(date: string, bookings: BookingInput[]): Date[] {
  return bookings.filter((b) => b.status === 'BOOKED' && utcToSofia(b.endAt).date === date).map((b) => b.endAt);
}

// True when startAt is exactly the end of a BOOKED booking on this Sofia date.
export function isBookingEnd(startAt: Date, date: string, bookings: BookingInput[]): boolean {
  return bookingEnds(date, bookings).some((end) => end.getTime() === startAt.getTime());
}
