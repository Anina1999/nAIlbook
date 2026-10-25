import { describe, expect, it } from 'vitest';
import { canCancel } from '../../src/scheduling/booking.js';
import type { BookingStatus, CancellableBooking } from '../../src/scheduling/types.js';

const CLIENT = 10;
const MANICURIST = 20;
const OTHER = 30;
const START = new Date('2026-11-04T09:00:00.000Z');
const BEFORE = new Date('2026-11-01T10:00:00.000Z');
const AFTER = new Date('2026-11-05T10:00:00.000Z');

function booking(status: BookingStatus = 'BOOKED'): CancellableBooking {
  return {
    clientId: CLIENT,
    manicuristId: MANICURIST,
    startAt: START,
    endAt: new Date('2026-11-04T10:00:00.000Z'),
    status,
  };
}

describe('canCancel', () => {
  it('lets the client cancel an upcoming booking', () => {
    expect(canCancel(booking(), CLIENT, BEFORE)).toEqual({ ok: true, cancelledBy: 'CLIENT' });
  });

  it('lets the manicurist cancel an upcoming booking', () => {
    expect(canCancel(booking(), MANICURIST, BEFORE)).toEqual({ ok: true, cancelledBy: 'MANICURIST' });
  });

  it('returns FORBIDDEN for anyone else', () => {
    expect(canCancel(booking(), OTHER, BEFORE)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('returns FORBIDDEN for anyone else before checking the state, on a past or cancelled booking', () => {
    expect(canCancel(booking(), OTHER, AFTER)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(canCancel(booking('CANCELLED'), OTHER, BEFORE)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('returns NOT_CANCELLABLE for a cancelled booking', () => {
    expect(canCancel(booking('CANCELLED'), CLIENT, BEFORE)).toMatchObject({ ok: false, code: 'NOT_CANCELLABLE' });
  });

  it('returns NOT_CANCELLABLE when the booking starts now', () => {
    expect(canCancel(booking(), CLIENT, START)).toMatchObject({ ok: false, code: 'NOT_CANCELLABLE' });
  });

  it('returns NOT_CANCELLABLE for a booking in the past', () => {
    expect(canCancel(booking(), MANICURIST, AFTER)).toMatchObject({ ok: false, code: 'NOT_CANCELLABLE' });
  });
});
