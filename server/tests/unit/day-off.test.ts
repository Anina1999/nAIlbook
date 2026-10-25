import { describe, expect, it } from 'vitest';
import { canMarkDayOff } from '../../src/scheduling/day-off.js';
import type { BookingInput, BookingStatus } from '../../src/scheduling/types.js';

// now is 00:30 on 2026-11-04 in Sofia (winter time, UTC+2), which is still
// 2026-11-03 in UTC. "Today" must be the Sofia date.
const NOW = new Date('2026-11-03T22:30:00.000Z');
const TARGET = '2026-11-10';

// Extra fields stand in for what the route loads (id, service, client), to
// show that canMarkDayOff hands the bookings back as they were passed.
interface LoadedBooking extends BookingInput {
  id: number;
  clientName: string;
}

function booking(id: number, startIso: string, status: BookingStatus = 'BOOKED'): LoadedBooking {
  const startAt = new Date(startIso);
  return { id, clientName: `Client ${id}`, startAt, endAt: new Date(startAt.getTime() + 3_600_000), status };
}

describe('canMarkDayOff', () => {
  it('accepts today in Sofia', () => {
    expect(canMarkDayOff('2026-11-04', [], [], NOW)).toEqual({ ok: true });
  });

  it('accepts a future date', () => {
    expect(canMarkDayOff(TARGET, [], [], NOW)).toEqual({ ok: true });
  });

  it('returns SLOT_INVALID for yesterday in Sofia, even though it is still that date in UTC', () => {
    expect(canMarkDayOff('2026-11-03', [], [], NOW)).toMatchObject({ ok: false, code: 'SLOT_INVALID' });
  });

  it('returns ALREADY_DAY_OFF when the date is already an active day off', () => {
    expect(canMarkDayOff(TARGET, [TARGET], [], NOW)).toMatchObject({ ok: false, code: 'ALREADY_DAY_OFF' });
  });

  it('returns DAY_HAS_BOOKINGS with the bookings on that Sofia date, as they were passed', () => {
    const tenAm = booking(1, '2026-11-10T08:00:00.000Z'); // 10:00 local on the date
    const halfPastMidnight = booking(2, '2026-11-09T22:30:00.000Z'); // 00:30 local on the date, the day before in UTC
    const dayBefore = booking(3, '2026-11-09T21:30:00.000Z'); // 23:30 local the day before
    const dayAfter = booking(4, '2026-11-10T22:30:00.000Z'); // 00:30 local the day after, still the date in UTC
    const cancelled = booking(5, '2026-11-10T10:00:00.000Z', 'CANCELLED');

    const result = canMarkDayOff(TARGET, [], [tenAm, halfPastMidnight, dayBefore, dayAfter, cancelled], NOW);
    expect(result).toMatchObject({ ok: false, code: 'DAY_HAS_BOOKINGS' });
    if (result.ok) return;
    expect(result.details?.bookings).toEqual([tenAm, halfPastMidnight]);
  });

  it('accepts a date whose only bookings are cancelled or on other days', () => {
    const bookings = [
      booking(1, '2026-11-10T08:00:00.000Z', 'CANCELLED'),
      booking(2, '2026-11-09T21:30:00.000Z'),
      booking(3, '2026-11-10T22:30:00.000Z'),
    ];
    expect(canMarkDayOff(TARGET, [], bookings, NOW)).toEqual({ ok: true });
  });

  describe('check order', () => {
    it('returns SLOT_INVALID for a past date that is a day off and has bookings', () => {
      const bookings = [booking(1, '2026-11-02T08:00:00.000Z')];
      expect(canMarkDayOff('2026-11-02', ['2026-11-02'], bookings, NOW)).toMatchObject({
        ok: false,
        code: 'SLOT_INVALID',
      });
    });

    it('returns ALREADY_DAY_OFF before DAY_HAS_BOOKINGS', () => {
      const bookings = [booking(1, '2026-11-10T08:00:00.000Z')];
      expect(canMarkDayOff(TARGET, [TARGET], bookings, NOW)).toMatchObject({ ok: false, code: 'ALREADY_DAY_OFF' });
    });
  });
});
