import { describe, expect, it } from 'vitest';
import { validateBooking } from '../../src/scheduling/booking.js';
import { canMarkDayOff } from '../../src/scheduling/day-off.js';
import { calculateAvailableSlots } from '../../src/scheduling/slots.js';
import type { BookingInput, ValidateBookingInput, WorkingHoursInput } from '../../src/scheduling/types.js';

// The 12-month horizon: the last date that can be booked or marked as a day
// off is today in Sofia plus 12 calendar months, inclusive. Dates and
// instants are written out by hand, never built with lib/time.ts.
//
// NOW is 12:00 in Sofia on 2026-10-27, so the last date is 2027-10-27 and the
// next one, 2027-10-28, is out. Sofia is on summer time (UTC+3) on both of
// them: the switch back is on 2027-10-31. So 10:00 local is 07:00Z.
const NOW = new Date('2026-10-27T10:00:00.000Z');
const LAST = '2027-10-27';
const NEXT = '2027-10-28';

const CYRILLIC = /\p{Script=Cyrillic}/u;

const everyDay = (startMin: number, endMin: number): WorkingHoursInput[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin, endMin }));
const EVERY_DAY_10_14 = everyDay(10 * 60, 14 * 60);
const EVERY_DAY_ALL_DAY = everyDay(0, 24 * 60);

// 10:00 to 13:00 local in summer time, every 30 minutes (60-minute service, work ends 14:00).
const SLOTS_10_TO_13 = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'];
const utc = (date: string, time: string) => `${date}T${time}:00.000Z`;
const at = (date: string, time: string) => new Date(utc(date, time));

function booked(date: string, startZ: string, endZ: string): BookingInput {
  return { startAt: at(date, startZ), endAt: at(date, endZ), status: 'BOOKED' };
}

describe('calculateAvailableSlots: the 12-month horizon', () => {
  const slots = (date: string, now = NOW) =>
    calculateAvailableSlots({ durationMin: 60 }, date, EVERY_DAY_10_14, [], [], now);

  it('returns the slots of the last date', () => {
    expect(slots(LAST)).toEqual(SLOTS_10_TO_13.map((t) => utc(LAST, t)));
  });

  it('returns [] for the day after the last date, although it has working hours', () => {
    expect(slots(NEXT)).toEqual([]);
    expect(slots('2027-11-15')).toEqual([]);
  });

  it('returns [] far beyond the horizon', () => {
    expect(slots('2030-05-06')).toEqual([]);
  });

  it('uses the Sofia date of now: 00:30 on the 28th makes the 28th the last date', () => {
    const afterMidnight = new Date('2026-10-27T22:30:00.000Z'); // 00:30 on 2026-10-28 in Sofia
    expect(slots(NEXT, afterMidnight)).toEqual(SLOTS_10_TO_13.map((t) => utc(NEXT, t)));
    expect(slots('2027-10-29', afterMidnight)).toEqual([]);
  });

  it('uses the Sofia date of now: 23:30 on the 27th keeps the 28th out, although it is the 27th in UTC', () => {
    const beforeMidnight = new Date('2026-10-27T21:30:00.000Z'); // 23:30 on 2026-10-27 in Sofia
    expect(slots(LAST, beforeMidnight)).toHaveLength(7);
    expect(slots(NEXT, beforeMidnight)).toEqual([]);
  });

  it('turns the limit for 29 February into 28 February', () => {
    const leapDay = new Date('2028-02-29T10:00:00.000Z');
    expect(slots('2029-02-28', leapDay)).toHaveLength(7);
    expect(slots('2029-03-01', leapDay)).toEqual([]);
  });
});

describe('validateBooking: the 12-month horizon', () => {
  function input(startAt: Date, overrides: Partial<ValidateBookingInput> = {}): ValidateBookingInput {
    return {
      manicuristId: 1,
      service: { manicuristId: 1, durationMin: 60 },
      startAt,
      workingHours: EVERY_DAY_10_14,
      daysOff: [],
      bookings: [],
      now: NOW,
      ...overrides,
    };
  }

  it('accepts a start on the last date', () => {
    expect(validateBooking(input(at(LAST, '07:00')))).toEqual({ ok: true, endAt: at(LAST, '08:00') });
  });

  it('returns SLOT_INVALID with a Bulgarian message for a start on the next date', () => {
    const result = validateBooking(input(at(NEXT, '07:00')));
    expect(result).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
    if (result.ok) return;
    expect(result.message).toMatch(CYRILLIC);
  });

  it('returns SLOT_INVALID for a start far beyond the horizon', () => {
    expect(validateBooking(input(at('2030-05-06', '07:00')))).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('checks the horizon before SLOT_TAKEN', () => {
    const taken = booked(NEXT, '07:00', '08:00');
    expect(validateBooking(input(at(NEXT, '07:00'), { bookings: [taken] }))).toMatchObject({
      ok: false,
      code: 'SLOT_INVALID',
    });
  });

  it('checks DAY_OFF before the horizon', () => {
    expect(validateBooking(input(at(NEXT, '07:00'), { daysOff: [NEXT] }))).toMatchObject({
      ok: false,
      code: 'DAY_OFF',
    });
  });

  it('uses the Sofia date of the start: 00:00 on the 28th is the 27th in UTC but out', () => {
    // 2027-10-28 00:00 in Sofia (UTC+3) is 2027-10-27T21:00Z, the last date in UTC.
    const result = validateBooking(input(at(LAST, '21:00'), { workingHours: EVERY_DAY_ALL_DAY }));
    expect(result).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('uses the Sofia date of the start: 23:30 on the 27th is the last date', () => {
    const result = validateBooking(
      input(at(LAST, '20:30'), {
        workingHours: EVERY_DAY_ALL_DAY,
        service: { manicuristId: 1, durationMin: 30 },
      }),
    );
    expect(result).toEqual({ ok: true, endAt: at(LAST, '21:00') });
  });

  it('uses the Sofia date of now: 00:30 on the 28th makes a start on the 28th valid', () => {
    const afterMidnight = new Date('2026-10-27T22:30:00.000Z'); // 00:30 on 2026-10-28 in Sofia
    expect(validateBooking(input(at(NEXT, '07:00'), { now: afterMidnight }))).toMatchObject({ ok: true });
    expect(validateBooking(input(at('2027-10-29', '07:00'), { now: afterMidnight }))).toMatchObject({
      ok: false,
      code: 'SLOT_INVALID',
    });
  });

  it('turns the limit for 29 February into 28 February', () => {
    const leapDay = new Date('2028-02-29T10:00:00.000Z');
    // Winter time (UTC+2) on both dates: 10:00 local is 08:00Z.
    expect(validateBooking(input(at('2029-02-28', '08:00'), { now: leapDay }))).toMatchObject({ ok: true });
    expect(validateBooking(input(at('2029-03-01', '08:00'), { now: leapDay }))).toMatchObject({
      ok: false,
      code: 'SLOT_INVALID',
    });
  });
});

describe('canMarkDayOff: the 12-month horizon', () => {
  it('accepts the last date', () => {
    expect(canMarkDayOff(LAST, [], [], NOW)).toEqual({ ok: true });
  });

  it('returns SLOT_INVALID with a Bulgarian message for the next date', () => {
    const result = canMarkDayOff(NEXT, [], [], NOW);
    expect(result).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
    if (result.ok) return;
    expect(result.message).toMatch(CYRILLIC);
  });

  it('returns SLOT_INVALID far beyond the horizon', () => {
    expect(canMarkDayOff('2030-05-06', [], [], NOW)).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('checks the horizon before ALREADY_DAY_OFF', () => {
    expect(canMarkDayOff(NEXT, [NEXT], [], NOW)).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('checks the horizon before DAY_HAS_BOOKINGS', () => {
    expect(canMarkDayOff(NEXT, [], [booked(NEXT, '07:00', '08:00')], NOW)).toMatchObject({
      ok: false,
      code: 'SLOT_INVALID',
    });
  });

  it('still returns ALREADY_DAY_OFF and DAY_HAS_BOOKINGS on the last date', () => {
    expect(canMarkDayOff(LAST, [LAST], [], NOW)).toMatchObject({ ok: false, code: 'ALREADY_DAY_OFF' });
    expect(canMarkDayOff(LAST, [], [booked(LAST, '07:00', '08:00')], NOW)).toMatchObject({
      ok: false,
      code: 'DAY_HAS_BOOKINGS',
    });
  });

  it('uses the Sofia date of now: 00:30 on the 28th makes the 28th the last date', () => {
    const afterMidnight = new Date('2026-10-27T22:30:00.000Z');
    expect(canMarkDayOff(NEXT, [], [], afterMidnight)).toEqual({ ok: true });
    expect(canMarkDayOff('2027-10-29', [], [], afterMidnight)).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('uses the Sofia date of now: 23:30 on the 27th keeps the 28th out', () => {
    const beforeMidnight = new Date('2026-10-27T21:30:00.000Z');
    expect(canMarkDayOff(LAST, [], [], beforeMidnight)).toEqual({ ok: true });
    expect(canMarkDayOff(NEXT, [], [], beforeMidnight)).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('turns the limit for 29 February into 28 February', () => {
    const leapDay = new Date('2028-02-29T10:00:00.000Z');
    expect(canMarkDayOff('2029-02-28', [], [], leapDay)).toEqual({ ok: true });
    expect(canMarkDayOff('2029-03-01', [], [], leapDay)).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });
});
