import { describe, expect, it } from 'vitest';
import { validateBooking } from '../../src/scheduling/booking.js';
import { calculateAvailableSlots } from '../../src/scheduling/slots.js';
import type {
  BookingInput,
  BookingStatus,
  ValidateBookingInput,
  WorkingHoursInput,
} from '../../src/scheduling/types.js';

// 2026-11-04 is a Wednesday in winter time (Sofia = UTC+2), so 10:00 local is
// 08:00Z. Expected values are written out by hand, never built with lib/time.ts.
const DATE = '2026-11-04';
const BEFORE = new Date('2026-11-01T10:00:00.000Z');
const h = (hour: number, minute = 0) => hour * 60 + minute;
const at = (time: string) => new Date(`${DATE}T${time}:00.000Z`);

// Wednesday 10:00–14:00 local, manicurist 1, a 60-minute service.
const HOURS: WorkingHoursInput[] = [{ weekday: 3, startMin: h(10), endMin: h(14) }];

function input(overrides: Partial<ValidateBookingInput> = {}): ValidateBookingInput {
  return {
    manicuristId: 1,
    service: { manicuristId: 1, durationMin: 60 },
    startAt: at('09:00'),
    workingHours: HOURS,
    daysOff: [],
    bookings: [],
    now: BEFORE,
    ...overrides,
  };
}

function booking(startZ: string, endZ: string, status: BookingStatus = 'BOOKED'): BookingInput {
  return { startAt: at(startZ), endAt: at(endZ), status };
}

describe('validateBooking', () => {
  it('accepts a free start on the grid and returns endAt = start + duration', () => {
    expect(validateBooking(input())).toEqual({ ok: true, endAt: at('10:00') });
  });

  it('returns NOT_FOUND when the service does not exist', () => {
    expect(validateBooking(input({ service: null }))).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('returns NOT_FOUND when the service belongs to another manicurist', () => {
    const service = { manicuristId: 2, durationMin: 60 };
    expect(validateBooking(input({ service }))).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('returns DAY_OFF on a day off', () => {
    expect(validateBooking(input({ daysOff: [DATE] }))).toMatchObject({ ok: false, code: 'DAY_OFF' });
  });

  it('returns SLOT_INVALID for a start off the grid (10:15 local)', () => {
    expect(validateBooking(input({ startAt: at('08:15') }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns SLOT_INVALID for a start with seconds (10:00:30 local)', () => {
    const startAt = new Date(`${DATE}T08:00:30.000Z`);
    expect(validateBooking(input({ startAt }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  describe('on the autumn switch day, 2026-10-25 (03:00–04:00 local happens twice)', () => {
    const sundayHours: WorkingHoursInput[] = [{ weekday: 0, startMin: h(3), endMin: h(5) }];
    const now = new Date('2026-10-01T00:00:00.000Z');

    it('accepts the first 03:30 (00:30Z)', () => {
      const startAt = new Date('2026-10-25T00:30:00.000Z');
      expect(validateBooking(input({ startAt, workingHours: sundayHours, now }))).toEqual({
        ok: true,
        endAt: new Date('2026-10-25T01:30:00.000Z'),
      });
    });

    it('returns SLOT_INVALID for the second 03:30 (01:30Z)', () => {
      const startAt = new Date('2026-10-25T01:30:00.000Z');
      expect(validateBooking(input({ startAt, workingHours: sundayHours, now }))).toMatchObject({
        ok: false,
        code: 'SLOT_INVALID',
      });
    });
  });

  it('returns SLOT_INVALID on a weekday without working hours', () => {
    // Sunday 2026-11-08, 10:00 local.
    const startAt = new Date('2026-11-08T08:00:00.000Z');
    expect(validateBooking(input({ startAt }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns SLOT_INVALID for a start before the working hours (09:30 local)', () => {
    expect(validateBooking(input({ startAt: at('07:30') }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns SLOT_INVALID when the service would end after the working hours (13:30 + 60 min)', () => {
    expect(validateBooking(input({ startAt: at('11:30') }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns SLOT_INVALID for a start equal to now', () => {
    expect(validateBooking(input({ now: at('09:00') }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns SLOT_INVALID for a start in the past', () => {
    const now = new Date('2026-11-05T10:00:00.000Z');
    expect(validateBooking(input({ now }))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns SLOT_TAKEN when the start overlaps a booking', () => {
    // Booked 11:00–12:00 local; 11:30 and 11:00 both overlap it.
    const bookings = [booking('09:00', '10:00')];
    expect(validateBooking(input({ startAt: at('09:30'), bookings }))).toMatchObject({
      ok: false,
      code: 'SLOT_TAKEN',
    });
    expect(validateBooking(input({ startAt: at('09:00'), bookings }))).toMatchObject({
      ok: false,
      code: 'SLOT_TAKEN',
    });
  });

  it('accepts a start between back-to-back bookings', () => {
    // Booked 10:00–11:00 and 12:00–13:00 local; 11:00–12:00 fits exactly.
    const bookings = [booking('08:00', '09:00'), booking('10:00', '11:00')];
    expect(validateBooking(input({ bookings }))).toEqual({ ok: true, endAt: at('10:00') });
  });

  it('does not let a cancelled booking block the start', () => {
    const bookings = [booking('09:00', '10:00', 'CANCELLED')];
    expect(validateBooking(input({ bookings }))).toEqual({ ok: true, endAt: at('10:00') });
  });

  it('returns the first failure in the skill order: a past start on a day off is DAY_OFF', () => {
    const now = new Date('2026-11-05T10:00:00.000Z');
    expect(validateBooking(input({ daysOff: [DATE], now }))).toMatchObject({ ok: false, code: 'DAY_OFF' });
  });

  it('agrees with calculateAvailableSlots on every grid start of the day', () => {
    // Booked 11:00–12:00 local. Grid starts 10:00–13:00 local.
    const bookings = [booking('09:00', '10:00')];
    const service = { manicuristId: 1, durationMin: 60 };
    const slots = calculateAvailableSlots(service, DATE, HOURS, [], bookings, BEFORE);
    expect(slots.length).toBeGreaterThan(0);

    for (const time of ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']) {
      const startAt = at(time);
      const result = validateBooking(input({ startAt, bookings }));
      if (slots.includes(startAt.toISOString())) {
        expect(result).toMatchObject({ ok: true });
      } else {
        expect(result).toMatchObject({ ok: false, code: 'SLOT_TAKEN' });
      }
    }
  });
});
