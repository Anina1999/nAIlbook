import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { createBooking } from '../../src/modules/bookings/service.js';
import { markDayOff } from '../../src/modules/catalog/service.js';
import { nextWeekday, slotAt } from '../helpers/dates.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createClient, createDayOff, createManicurist } from '../helpers/factories.js';

beforeEach(() => resetDb());
afterAll(() => prisma.$disconnect());

const codesOf = (results: PromiseSettledResult<unknown>[]) =>
  results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as AppError).code] : []));

// Like bookings-race.test.ts, these call the services directly: through HTTP
// the middleware spaces the requests out, so a race test there passes even
// without the transaction. Here the checks of all calls interleave, and only
// the transactions keep them apart.
describe('markDayOff and createBooking', () => {
  it('lets exactly one of them win when they race for the same day', async () => {
    const client = await createClient();
    const rounds = 8;
    const outcomes: string[] = [];

    for (let i = 0; i < rounds; i++) {
      const manicurist = await createManicurist();
      const date = nextWeekday(1);
      const booking = createBooking(
        client.id,
        {
          manicuristId: manicurist.id,
          serviceId: manicurist.profile!.services[0].id,
          startAt: new Date(slotAt(date, '10:00')),
        },
        new Date(),
      );
      const dayOff = markDayOff(manicurist.id, date, new Date());

      const [bookingResult, dayOffResult] = await Promise.allSettled([booking, dayOff]);

      const bookings = await prisma.booking.count({ where: { manicuristId: manicurist.id } });
      const daysOff = await prisma.dayOff.count({ where: { manicuristId: manicurist.id, deletedAt: null } });
      // Never both, never neither.
      expect(bookings + daysOff).toBe(1);

      if (bookingResult.status === 'fulfilled') {
        expect(dayOffResult.status).toBe('rejected');
        expect(codesOf([dayOffResult])).toEqual(['DAY_HAS_BOOKINGS']);
        expect(bookings).toBe(1);
        outcomes.push('booking');
      } else {
        expect(dayOffResult.status).toBe('fulfilled');
        expect(codesOf([bookingResult])).toEqual(['DAY_OFF']);
        expect(daysOff).toBe(1);
        outcomes.push('dayOff');
      }
    }

    expect(outcomes).toHaveLength(rounds);
  });

  it('lets several clients and a day off race for one day: a booking or the day off, never both', async () => {
    const manicurist = await createManicurist();
    const clients = await Promise.all([1, 2, 3, 4].map(() => createClient()));
    const date = nextWeekday(1);
    const serviceId = manicurist.profile!.services[0].id;

    const bookings = clients.map((c, i) =>
      createBooking(
        c.id,
        { manicuristId: manicurist.id, serviceId, startAt: new Date(slotAt(date, ['10:00', '12:00', '14:00', '16:00'][i])) },
        new Date(),
      ),
    );
    const results = await Promise.allSettled([markDayOff(manicurist.id, date, new Date()), ...bookings]);

    const booked = await prisma.booking.count();
    const daysOff = await prisma.dayOff.count({ where: { deletedAt: null } });
    expect(booked === 0 || daysOff === 0).toBe(true);
    expect(booked + daysOff).toBeGreaterThan(0);
    // Every failure is one of the two conflicts, nothing else.
    expect(codesOf(results).every((c) => c === 'DAY_HAS_BOOKINGS' || c === 'DAY_OFF')).toBe(true);
  });
});

describe('markDayOff', () => {
  it('marks a date once when several calls race for it', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekday(1);

    const results = await Promise.allSettled([1, 2, 3, 4, 5, 6].map(() => markDayOff(manicurist.id, date, new Date())));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(codesOf(results)).toEqual(Array(5).fill('ALREADY_DAY_OFF'));
    expect(await prisma.dayOff.count()).toBe(1);
    expect(await prisma.dayOff.count({ where: { deletedAt: null } })).toBe(1);
  });

  it('reuses the removed row once when several calls race for the removed date', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekday(1);
    const removed = await createDayOff(manicurist, date, { deletedAt: new Date() });

    const results = await Promise.allSettled([1, 2, 3, 4].map(() => markDayOff(manicurist.id, date, new Date())));

    const fulfilled = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    expect(fulfilled).toEqual([{ id: removed.id, date }]);
    expect(codesOf(results)).toEqual(Array(3).fill('ALREADY_DAY_OFF'));
    expect(await prisma.dayOff.count()).toBe(1);
    expect(await prisma.dayOff.count({ where: { deletedAt: null } })).toBe(1);
  });
});
