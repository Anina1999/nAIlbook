import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { createBooking } from '../../src/modules/bookings/service.js';
import { nextWeekday, slotAt } from '../helpers/dates.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createClient, createManicurist } from '../helpers/factories.js';

beforeEach(() => resetDb());
afterAll(() => prisma.$disconnect());

// Calls the service directly: through HTTP the middleware spaces the requests
// out, so a race test there passes even without the transaction. Here the
// checks of all calls interleave, and only the transaction keeps them apart.
describe('createBooking', () => {
  it('books a slot only once when several clients race for it', async () => {
    const manicurist = await createManicurist();
    const clients = await Promise.all([1, 2, 3, 4, 5, 6].map(() => createClient()));
    const input = {
      manicuristId: manicurist.id,
      serviceId: manicurist.profile!.services[0].id,
      startAt: new Date(slotAt(nextWeekday(1), '10:00')),
    };

    const results = await Promise.allSettled(clients.map((c) => createBooking(c.id, input, new Date())));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const codes = results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as AppError).code] : []));
    expect(codes).toEqual(Array(5).fill('SLOT_TAKEN'));
    expect(await prisma.booking.count()).toBe(1);
  });
});
