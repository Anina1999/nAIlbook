import { describe, expect, it } from 'vitest';
import { calculateAvailableSlots } from '../../src/scheduling/slots.js';
import type { BookingInput, BookingStatus, WorkingHoursInput } from '../../src/scheduling/types.js';

// 2026-11-04 is a Wednesday in winter time (Sofia = UTC+2), so 10:00 local is
// 08:00Z. Expected values are written out by hand, never built with lib/time.ts.
const DATE = '2026-11-04';
const BEFORE = new Date('2026-11-01T10:00:00.000Z');
const h = (hour: number, minute = 0) => hour * 60 + minute;
const utc = (time: string) => `${DATE}T${time}:00.000Z`;

// Wednesday 10:00–14:00, Thursday 08:00–20:00, nothing on Sunday.
const HOURS: WorkingHoursInput[] = [
  { weekday: 3, startMin: h(10), endMin: h(14) },
  { weekday: 4, startMin: h(8), endMin: h(20) },
];

const ALL_WEDNESDAY = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'].map(utc);

function booking(startZ: string, endZ: string, status: BookingStatus = 'BOOKED'): BookingInput {
  return { startAt: new Date(utc(startZ)), endAt: new Date(utc(endZ)), status };
}

describe('calculateAvailableSlots', () => {
  it('returns every 30-minute start that fits, in ascending order', () => {
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], [], BEFORE)).toEqual(ALL_WEDNESDAY);
  });

  it('returns [] on a day off, even when the weekday has working hours', () => {
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [DATE], [], BEFORE)).toEqual([]);
  });

  it('ignores a day off on another date', () => {
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, ['2026-11-05'], [], BEFORE)).toEqual(
      ALL_WEDNESDAY,
    );
  });

  it('returns [] on a weekday without working hours', () => {
    expect(calculateAvailableSlots({ durationMin: 60 }, '2026-11-08', HOURS, [], [], BEFORE)).toEqual([]);
  });

  it('keeps the last start on the grid when the service is not a multiple of 30 minutes', () => {
    // 13:00 + 45 min ends at 13:45; 13:15 is off the grid and 13:30 would end at 14:15.
    expect(calculateAvailableSlots({ durationMin: 45 }, DATE, HOURS, [], [], BEFORE)).toEqual(ALL_WEDNESDAY);
  });

  it('returns [] when the service is longer than the working day', () => {
    expect(calculateAvailableSlots({ durationMin: 300 }, DATE, HOURS, [], [], BEFORE)).toEqual([]);
  });

  it('drops starts that overlap a booking', () => {
    // Booked 11:00–12:00 local.
    const bookings = [booking('09:00', '10:00')];
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
      ['08:00', '10:00', '10:30', '11:00'].map(utc),
    );
  });

  it('drops a longer service that would run into a booking', () => {
    // Booked 11:00–12:00 local; a 90-minute service from 10:00 would end at 11:30.
    const bookings = [booking('09:00', '10:00')];
    expect(calculateAvailableSlots({ durationMin: 90 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
      ['10:00', '10:30'].map(utc),
    );
  });

  it('allows starts that end exactly when a booking starts or begin when it ends', () => {
    // Booked 10:00–11:00 and 12:00–13:00 local.
    const bookings = [booking('08:00', '09:00'), booking('10:00', '11:00')];
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
      ['09:00', '11:00'].map(utc),
    );
  });

  it('does not let a cancelled booking block a slot', () => {
    const bookings = [booking('09:00', '10:00', 'CANCELLED')];
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(ALL_WEDNESDAY);
  });

  it('drops past starts today, including a start equal to now', () => {
    // now is 11:00 local.
    const now = new Date(utc('09:00'));
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], [], now)).toEqual(
      ['09:30', '10:00', '10:30', '11:00'].map(utc),
    );
  });

  it('returns [] for a date that is already over', () => {
    const now = new Date('2026-11-05T10:00:00.000Z');
    expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], [], now)).toEqual([]);
  });

  describe('on daylight-saving switch days', () => {
    // Both are Sundays: 09:00–11:00 local, 60-minute service.
    const sundayHours: WorkingHoursInput[] = [{ weekday: 0, startMin: h(9), endMin: h(11) }];
    const longBefore = new Date('2026-01-01T00:00:00.000Z');

    it('keeps the local grid on 2026-03-29 (summer time from 03:00, UTC+3)', () => {
      expect(calculateAvailableSlots({ durationMin: 60 }, '2026-03-29', sundayHours, [], [], longBefore)).toEqual([
        '2026-03-29T06:00:00.000Z',
        '2026-03-29T06:30:00.000Z',
        '2026-03-29T07:00:00.000Z',
      ]);
    });

    it('keeps the local grid on 2026-10-25 (winter time from 04:00, UTC+2)', () => {
      expect(calculateAvailableSlots({ durationMin: 60 }, '2026-10-25', sundayHours, [], [], longBefore)).toEqual([
        '2026-10-25T07:00:00.000Z',
        '2026-10-25T07:30:00.000Z',
        '2026-10-25T08:00:00.000Z',
      ]);
    });

    it('offers the end of a booking off the grid on 2026-03-29', () => {
      // Booked 09:00–09:40 local (06:00Z–06:40Z); 09:40 + 60 min ends at 10:40.
      const bookings: BookingInput[] = [
        { startAt: new Date('2026-03-29T06:00:00.000Z'), endAt: new Date('2026-03-29T06:40:00.000Z'), status: 'BOOKED' },
      ];
      expect(calculateAvailableSlots({ durationMin: 60 }, '2026-03-29', sundayHours, [], bookings, longBefore)).toEqual(
        ['2026-03-29T06:40:00.000Z', '2026-03-29T07:00:00.000Z'],
      );
    });

    it('offers the end of a booking off the grid on 2026-10-25', () => {
      // Booked 09:00–09:40 local (07:00Z–07:40Z); 09:40 + 60 min ends at 10:40.
      const bookings: BookingInput[] = [
        { startAt: new Date('2026-10-25T07:00:00.000Z'), endAt: new Date('2026-10-25T07:40:00.000Z'), status: 'BOOKED' },
      ];
      expect(calculateAvailableSlots({ durationMin: 60 }, '2026-10-25', sundayHours, [], bookings, longBefore)).toEqual(
        ['2026-10-25T07:40:00.000Z', '2026-10-25T08:00:00.000Z'],
      );
    });

    it('offers a booking end in the repeated hour of 2026-10-25 as that instant, not its first occurrence', () => {
      // 02:00–06:00 local. Booked from the first 03:30 (00:30Z) for 70 minutes,
      // so it ends at the second 03:40 (01:40Z). Rebuilt through sofiaToUtc,
      // 03:40 would be the first one (00:40Z), which the booking covers.
      const hours: WorkingHoursInput[] = [{ weekday: 0, startMin: h(2), endMin: h(6) }];
      const bookings: BookingInput[] = [
        { startAt: new Date('2026-10-25T00:30:00.000Z'), endAt: new Date('2026-10-25T01:40:00.000Z'), status: 'BOOKED' },
      ];
      expect(calculateAvailableSlots({ durationMin: 60 }, '2026-10-25', hours, [], bookings, longBefore)).toEqual([
        '2026-10-24T23:00:00.000Z',
        '2026-10-24T23:30:00.000Z',
        '2026-10-25T01:40:00.000Z',
        '2026-10-25T02:00:00.000Z',
        '2026-10-25T02:30:00.000Z',
        '2026-10-25T03:00:00.000Z',
      ]);
    });
  });

  describe('with starts at the end of a booking', () => {
    it('offers the end of a 40-minute booking (10:30 + 40 min = 11:10 local)', () => {
      // Booked 10:30–11:10 local; 10:00, 10:30 and 11:00 overlap it.
      const bookings = [booking('08:30', '09:10')];
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
        ['09:10', '09:30', '10:00', '10:30', '11:00'].map(utc),
      );
    });

    it('does not offer a booking end when the service does not fit before the next booking', () => {
      // Booked 10:30–11:10 and 12:00–13:00 local; 11:10 + 60 min would end at 12:10.
      const bookings = [booking('08:30', '09:10'), booking('10:00', '11:00')];
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
        ['11:00'].map(utc),
      );
    });

    it('does not offer a booking end when the service does not fit before the end of the day', () => {
      // Booked 12:30–13:10 local; 13:10 + 60 min would end at 14:10, after 14:00.
      const bookings = [booking('10:30', '11:10')];
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
        ['08:00', '08:30', '09:00', '09:30'].map(utc),
      );
    });

    it('offers a booking end when the service ends exactly at the end of the day', () => {
      // Booked 12:30–13:10 local; 13:10 + 50 min ends at 14:00.
      const bookings = [booking('10:30', '11:10')];
      expect(calculateAvailableSlots({ durationMin: 50 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
        ['08:00', '08:30', '09:00', '09:30', '11:10'].map(utc),
      );
    });

    it('does not offer the end of a cancelled booking', () => {
      const bookings = [booking('08:30', '09:10', 'CANCELLED')];
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(ALL_WEDNESDAY);
    });

    it('does not offer a booking end before the working hours start', () => {
      // Booked 09:00–09:40 local, before the 10:00 start; 09:40 is not a candidate.
      const bookings = [booking('07:00', '07:40')];
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(ALL_WEDNESDAY);
    });

    it('lists a booking end on the grid only once', () => {
      // Booked 10:00–11:00 local; 11:00 is both a grid start and the booking end.
      const bookings = [booking('08:00', '09:00')];
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, BEFORE)).toEqual(
        ['09:00', '09:30', '10:00', '10:30', '11:00'].map(utc),
      );
    });

    it('keeps the starts in ascending order when a booking end falls between grid starts', () => {
      // Booked 11:00–11:40 local; 11:40 sits between 10:30 and 12:00.
      const bookings = [booking('09:00', '09:40')];
      const slots = calculateAvailableSlots({ durationMin: 30 }, DATE, HOURS, [], bookings, BEFORE);
      expect(slots).toEqual(['08:00', '08:30', '09:40', '10:00', '10:30', '11:00', '11:30'].map(utc));
      expect([...slots].sort()).toEqual(slots);
    });

    it('drops a booking end that is not after now', () => {
      // Booked 10:30–11:10 local; now is 11:10 local.
      const bookings = [booking('08:30', '09:10')];
      const now = new Date(utc('09:10'));
      expect(calculateAvailableSlots({ durationMin: 60 }, DATE, HOURS, [], bookings, now)).toEqual(
        ['09:30', '10:00', '10:30', '11:00'].map(utc),
      );
    });
  });
});
