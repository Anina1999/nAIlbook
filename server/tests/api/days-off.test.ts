import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { addDays, todayInSofia } from '../../src/lib/time.js';
import { authHeader } from '../helpers/auth.js';
import {
  daysAgo,
  daysAhead,
  horizonEnd,
  nextWeekday,
  nextWeekdayBeyondHorizon,
  slotAt,
} from '../helpers/dates.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createBooking, createClient, createDayOff, createManicurist } from '../helpers/factories.js';

beforeEach(() => resetDb());
afterAll(() => prisma.$disconnect());

const MONDAY = 1;

// The keys of the booking object (api-conventions, Response shapes).
const BOOKING_KEYS = [
  'cancelReason',
  'cancelledBy',
  'client',
  'endAt',
  'id',
  'manicurist',
  'priceCents',
  'serviceId',
  'serviceName',
  'startAt',
  'status',
];

const today = () => todayInSofia(new Date());

// Gives the manicurist working hours on Saturday and Sunday too, so a booking
// test can use any date, such as the last date of the horizon.
async function workEveryDay(manicuristId: number) {
  await prisma.workingHours.createMany({
    data: [0, 6].map((weekday) => ({ manicuristId, weekday, startMin: 9 * 60, endMin: 18 * 60 })),
  });
}

describe('GET /api/manicurists/:id/days-off', () => {
  const list = (manicuristId: number | string, query: object) =>
    request(app).get(`/api/manicurists/${manicuristId}/days-off`).query(query);

  it('returns the active days off in the range as dates, in ascending order, without a token', async () => {
    const manicurist = await createManicurist();
    const [d1, d2, d3] = [daysAhead(5), daysAhead(9), daysAhead(20)];
    // Created out of order on purpose.
    await createDayOff(manicurist, d3);
    await createDayOff(manicurist, d1);
    await createDayOff(manicurist, d2);

    const res = await list(manicurist.id, { from: daysAhead(0), to: daysAhead(30) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ daysOff: [d1, d2, d3] });
  });

  it('includes the days off on from and on to, and leaves out the ones outside', async () => {
    const manicurist = await createManicurist();
    const [from, to] = [daysAhead(10), daysAhead(20)];
    await createDayOff(manicurist, addDays(from, -1));
    await createDayOff(manicurist, from);
    await createDayOff(manicurist, to);
    await createDayOff(manicurist, addDays(to, 1));

    const res = await list(manicurist.id, { from, to });

    expect(res.status).toBe(200);
    expect(res.body.daysOff).toEqual([from, to]);
  });

  it('leaves out removed days off', async () => {
    const manicurist = await createManicurist();
    const [active, removed] = [daysAhead(5), daysAhead(6)];
    await createDayOff(manicurist, active);
    await createDayOff(manicurist, removed, { deletedAt: new Date() });

    const res = await list(manicurist.id, { from: daysAhead(0), to: daysAhead(30) });

    expect(res.body.daysOff).toEqual([active]);
  });

  it('returns only the days off of that manicurist', async () => {
    const [first, second] = [await createManicurist(), await createManicurist()];
    const [d1, d2] = [daysAhead(5), daysAhead(6)];
    await createDayOff(first, d1);
    await createDayOff(second, d2);

    const res = await list(first.id, { from: daysAhead(0), to: daysAhead(30) });

    expect(res.body.daysOff).toEqual([d1]);
  });

  it('returns an empty list when there are no days off', async () => {
    const manicurist = await createManicurist();

    const res = await list(manicurist.id, { from: daysAhead(0), to: daysAhead(30) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ daysOff: [] });
  });

  it('accepts a range of exactly 366 days', async () => {
    const manicurist = await createManicurist();

    const res = await list(manicurist.id, { from: daysAhead(0), to: daysAhead(366) });

    expect(res.status).toBe(200);
  });

  it('accepts from equal to to', async () => {
    const manicurist = await createManicurist();
    const date = daysAhead(5);
    await createDayOff(manicurist, date);

    const res = await list(manicurist.id, { from: date, to: date });

    expect(res.status).toBe(200);
    expect(res.body.daysOff).toEqual([date]);
  });

  const invalidQueries: Record<string, () => object> = {
    'a missing from and to': () => ({}),
    'a missing to': () => ({ from: daysAhead(0) }),
    'a missing from': () => ({ to: daysAhead(10) }),
    'a from that is not a date': () => ({ from: 'tomorrow', to: daysAhead(10) }),
    'a date that does not exist': () => ({ from: daysAhead(0), to: '2026-02-30' }),
    'a blank to': () => ({ from: daysAhead(0), to: '' }),
    'to before from': () => ({ from: daysAhead(10), to: daysAhead(9) }),
    'a range of 367 days': () => ({ from: daysAhead(0), to: daysAhead(367) }),
    'a repeated from': () => ({ from: [daysAhead(0), daysAhead(1)], to: daysAhead(10) }),
  };

  it.each(Object.keys(invalidQueries))('returns 400 VALIDATION_ERROR for %s', async (name) => {
    const manicurist = await createManicurist();

    const res = await list(manicurist.id, invalidQueries[name]());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for an id that is not a number', async () => {
    const res = await list('abc', { from: daysAhead(0), to: daysAhead(10) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for an unknown manicurist', async () => {
    const res = await list(999999, { from: daysAhead(0), to: daysAhead(10) });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for a user who is not a manicurist', async () => {
    const client = await createClient();

    const res = await list(client.id, { from: daysAhead(0), to: daysAhead(10) });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/me/days-off', () => {
  const mine = (user: Parameters<typeof authHeader>[0]) => request(app).get('/api/me/days-off').set(authHeader(user));

  it('returns the own active days off from today on as { id, date }, in ascending order', async () => {
    const manicurist = await createManicurist();
    const later = await createDayOff(manicurist, daysAhead(30));
    const todayRow = await createDayOff(manicurist, today());
    const soon = await createDayOff(manicurist, daysAhead(3));

    const res = await mine(manicurist);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      daysOff: [
        { id: todayRow.id, date: today() },
        { id: soon.id, date: daysAhead(3) },
        { id: later.id, date: daysAhead(30) },
      ],
    });
  });

  it('leaves out removed days off and past ones', async () => {
    const manicurist = await createManicurist();
    const active = await createDayOff(manicurist, daysAhead(5));
    await createDayOff(manicurist, daysAhead(6), { deletedAt: new Date() });
    await createDayOff(manicurist, daysAgo(1));
    await createDayOff(manicurist, daysAgo(30));

    const res = await mine(manicurist);

    expect(res.body.daysOff).toEqual([{ id: active.id, date: daysAhead(5) }]);
  });

  it('leaves out the days off of other manicurists', async () => {
    const [manicurist, other] = [await createManicurist(), await createManicurist()];
    const own = await createDayOff(manicurist, daysAhead(5));
    await createDayOff(other, daysAhead(6));

    const res = await mine(manicurist);

    expect(res.body.daysOff).toEqual([{ id: own.id, date: daysAhead(5) }]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/me/days-off');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const client = await createClient();

    const res = await mine(client);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/me/days-off', () => {
  const mark = (user: Parameters<typeof authHeader>[0], body: object) =>
    request(app).post('/api/me/days-off').set(authHeader(user)).send(body);

  it('marks a future date as a day off and returns 201 { dayOff: { id, date } }', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekday(MONDAY);

    const res = await mark(manicurist, { date });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ dayOff: { id: expect.any(Number), date } });
    const rows = await prisma.dayOff.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: res.body.dayOff.id, manicuristId: manicurist.id, date, deletedAt: null });
  });

  it('accepts today', async () => {
    const manicurist = await createManicurist();

    const res = await mark(manicurist, { date: today() });

    expect(res.status).toBe(201);
  });

  it('lets two manicurists mark the same date', async () => {
    const [first, second] = [await createManicurist(), await createManicurist()];
    const date = nextWeekday(MONDAY);

    expect((await mark(first, { date })).status).toBe(201);
    expect((await mark(second, { date })).status).toBe(201);
  });

  it('closes the date: the slots show a day off afterwards', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekday(MONDAY);

    await mark(manicurist, { date });
    const res = await request(app)
      .get(`/api/manicurists/${manicurist.id}/slots`)
      .query({ serviceId: manicurist.profile!.services[0].id, date });

    expect(res.body).toEqual({ date, dayOff: true, slots: [], busy: [] });
  });

  it('marks a removed date again on the same row and returns 201 with the same id', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekday(MONDAY);
    const removed = await createDayOff(manicurist, date, { deletedAt: new Date() });

    const res = await mark(manicurist, { date });

    expect(res.status).toBe(201);
    expect(res.body.dayOff).toEqual({ id: removed.id, date });
    const rows = await prisma.dayOff.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].deletedAt).toBeNull();
  });

  const invalidBodies: Record<string, object> = {
    'a missing date': {},
    'a date that is not a string': { date: 20261105 },
    'a date that is not a date': { date: 'tomorrow' },
    'a date that does not exist': { date: '2026-02-30' },
    'a date with a time': { date: `${nextWeekday(MONDAY)}T10:00:00.000Z` },
    'an empty date': { date: '' },
    'a null date': { date: null },
  };

  it.each(Object.entries(invalidBodies))('returns 400 VALIDATION_ERROR for %s', async (_, body) => {
    const manicurist = await createManicurist();

    const res = await mark(manicurist, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.dayOff.count()).toBe(0);
  });

  it('returns 400 SLOT_INVALID for a past date', async () => {
    const manicurist = await createManicurist();

    const res = await mark(manicurist, { date: daysAgo(1) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SLOT_INVALID');
    expect(await prisma.dayOff.count()).toBe(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/me/days-off').send({ date: nextWeekday(MONDAY) });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const client = await createClient();

    const res = await mark(client, { date: nextWeekday(MONDAY) });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.dayOff.count()).toBe(0);
  });

  describe('409 conflicts', () => {
    it('returns 409 ALREADY_DAY_OFF for a date that is already an active day off', async () => {
      const manicurist = await createManicurist();
      const date = nextWeekday(MONDAY);
      await createDayOff(manicurist, date);

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_DAY_OFF');
      expect(await prisma.dayOff.count()).toBe(1);
    });

    it('checks ALREADY_DAY_OFF before DAY_HAS_BOOKINGS', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      await createDayOff(manicurist, date);
      await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_DAY_OFF');
    });

    it('returns 409 DAY_HAS_BOOKINGS with the bookings of the date, as booking objects by start time', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      // Created out of order on purpose.
      const afternoon = await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '15:00')) });
      const morning = await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DAY_HAS_BOOKINGS');
      const { bookings } = res.body.error.details;
      expect(bookings.map((b: { id: number }) => b.id)).toEqual([morning.id, afternoon.id]);
      expect(Object.keys(bookings[0]).sort()).toEqual(BOOKING_KEYS);
      expect(bookings[0]).toMatchObject({
        id: morning.id,
        startAt: slotAt(date, '10:00'),
        endAt: slotAt(date, '11:00'),
        status: 'BOOKED',
        serviceName: 'Класически маникюр',
        client: { id: client.id, name: client.name, phone: client.phone },
      });
      expect(bookings[0].manicurist).toEqual({
        id: manicurist.id,
        name: manicurist.name,
        phone: manicurist.phone,
        city: manicurist.profile!.city,
        address: manicurist.profile!.address,
        latitude: manicurist.profile!.latitude,
        longitude: manicurist.profile!.longitude,
      });
      expect(bookings[0].client).not.toHaveProperty('email');
      expect(await prisma.dayOff.count()).toBe(0);
    });

    it('does not cancel the bookings it reports', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      const booking = await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });

      await mark(manicurist, { date });

      const row = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(row!.status).toBe('BOOKED');
    });

    it('counts a booking at 00:00 Sofia time, which is the day before in UTC', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '00:00')) });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DAY_HAS_BOOKINGS');
    });

    it('keeps a removed date closed to marking while it has bookings', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      await createDayOff(manicurist, date, { deletedAt: new Date() });
      await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DAY_HAS_BOOKINGS');
      const rows = await prisma.dayOff.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();
    });

    it('ignores cancelled bookings', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      await createBooking(client, manicurist, {
        startAt: new Date(slotAt(date, '10:00')),
        status: 'CANCELLED',
        cancelledBy: 'CLIENT',
        cancelReason: 'Промяна на плановете',
      });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(201);
    });

    it('ignores bookings on the neighbouring days, even at the edge of the day in Sofia time', async () => {
      const [client, manicurist] = [await createClient(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      await createBooking(client, manicurist, { startAt: new Date(slotAt(addDays(date, -1), '23:30')) });
      await createBooking(client, manicurist, { startAt: new Date(slotAt(addDays(date, 1), '00:00')) });
      await createBooking(client, manicurist, { startAt: new Date(slotAt(addDays(date, 1), '10:00')) });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(201);
    });

    it('ignores the bookings of other manicurists', async () => {
      const [client, manicurist, other] = [await createClient(), await createManicurist(), await createManicurist()];
      const date = nextWeekday(MONDAY);
      await createBooking(client, other, { startAt: new Date(slotAt(date, '10:00')) });

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(201);
    });
  });

  describe('the 12-month limit', () => {
    it('returns 400 SLOT_INVALID for a date after 12 months', async () => {
      const manicurist = await createManicurist();

      const res = await mark(manicurist, { date: addDays(horizonEnd(), 1) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SLOT_INVALID');
      expect(await prisma.dayOff.count()).toBe(0);
    });

    it('returns 400 SLOT_INVALID for a date far beyond it', async () => {
      const manicurist = await createManicurist();

      const res = await mark(manicurist, { date: daysAhead(800) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SLOT_INVALID');
    });

    it('accepts the last date, exactly 12 months from today', async () => {
      const manicurist = await createManicurist();
      const date = horizonEnd();

      const res = await mark(manicurist, { date });

      expect(res.status).toBe(201);
      expect(res.body.dayOff.date).toBe(date);
    });
  });
});

describe('DELETE /api/me/days-off/:id', () => {
  const remove = (user: Parameters<typeof authHeader>[0], id: number | string) =>
    request(app).delete(`/api/me/days-off/${id}`).set(authHeader(user));

  it('returns 204, sets deletedAt and keeps the row', async () => {
    const manicurist = await createManicurist();
    const dayOff = await createDayOff(manicurist, nextWeekday(MONDAY));

    const res = await remove(manicurist, dayOff.id);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const row = await prisma.dayOff.findUnique({ where: { id: dayOff.id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).toBeInstanceOf(Date);
  });

  it('reopens the date: it leaves both lists and the slots show no day off', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekday(MONDAY);
    const dayOff = await createDayOff(manicurist, date);

    await remove(manicurist, dayOff.id);

    const range = { from: daysAhead(0), to: daysAhead(30) };
    const publicList = await request(app).get(`/api/manicurists/${manicurist.id}/days-off`).query(range);
    expect(publicList.body.daysOff).toEqual([]);
    const own = await request(app).get('/api/me/days-off').set(authHeader(manicurist));
    expect(own.body.daysOff).toEqual([]);
    const slots = await request(app)
      .get(`/api/manicurists/${manicurist.id}/slots`)
      .query({ serviceId: manicurist.profile!.services[0].id, date });
    expect(slots.body.dayOff).toBe(false);
    expect(slots.body.slots).toHaveLength(17);
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const manicurist = await createManicurist();

    const res = await remove(manicurist, 999999);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for a day off that is already removed, and keeps its deletedAt', async () => {
    const manicurist = await createManicurist();
    const removedAt = new Date('2026-01-01T00:00:00.000Z');
    const dayOff = await createDayOff(manicurist, nextWeekday(MONDAY), { deletedAt: removedAt });

    const res = await remove(manicurist, dayOff.id);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    const row = await prisma.dayOff.findUnique({ where: { id: dayOff.id } });
    expect(row!.deletedAt).toEqual(removedAt);
  });

  it("returns 403 FORBIDDEN for another manicurist's day off and leaves it active", async () => {
    const [owner, other] = [await createManicurist(), await createManicurist()];
    const dayOff = await createDayOff(owner, nextWeekday(MONDAY));

    const res = await remove(other, dayOff.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const row = await prisma.dayOff.findUnique({ where: { id: dayOff.id } });
    expect(row!.deletedAt).toBeNull();
  });

  it("returns 404 NOT_FOUND for another manicurist's removed day off", async () => {
    const [owner, other] = [await createManicurist(), await createManicurist()];
    const dayOff = await createDayOff(owner, nextWeekday(MONDAY), { deletedAt: new Date() });

    const res = await remove(other, dayOff.id);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for an id that is not a number', async () => {
    const manicurist = await createManicurist();

    const res = await remove(manicurist, 'abc');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const manicurist = await createManicurist();
    const dayOff = await createDayOff(manicurist, nextWeekday(MONDAY));

    const res = await request(app).delete(`/api/me/days-off/${dayOff.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const [client, manicurist] = [await createClient(), await createManicurist()];
    const dayOff = await createDayOff(manicurist, nextWeekday(MONDAY));

    const res = await remove(client, dayOff.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('the 12-month limit for bookings and slots', () => {
  const slots = (manicuristId: number, query: object) =>
    request(app).get(`/api/manicurists/${manicuristId}/slots`).query(query);
  const book = (user: Parameters<typeof authHeader>[0], body: object) =>
    request(app).post('/api/bookings').set(authHeader(user)).send(body);

  it('returns 400 SLOT_INVALID when booking a working day after 12 months', async () => {
    const [client, manicurist] = [await createClient(), await createManicurist()];
    const date = nextWeekdayBeyondHorizon(MONDAY);

    const res = await book(client, {
      manicuristId: manicurist.id,
      serviceId: manicurist.profile!.services[0].id,
      startAt: slotAt(date, '10:00'),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SLOT_INVALID');
    expect(await prisma.booking.count()).toBe(0);
  });

  it('returns 200 with no slots for a working day after 12 months', async () => {
    const manicurist = await createManicurist();
    const date = nextWeekdayBeyondHorizon(MONDAY);

    const res = await slots(manicurist.id, { serviceId: manicurist.profile!.services[0].id, date });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date, dayOff: false, slots: [], busy: [] });
  });

  it('books and lists slots on the last date, exactly 12 months from today', async () => {
    const [client, manicurist] = [await createClient(), await createManicurist()];
    await workEveryDay(manicurist.id); // the last date can be any weekday
    const date = horizonEnd();
    const serviceId = manicurist.profile!.services[0].id;

    const list = await slots(manicurist.id, { serviceId, date });
    expect(list.status).toBe(200);
    expect(list.body.slots).toHaveLength(17);

    const res = await book(client, { manicuristId: manicurist.id, serviceId, startAt: slotAt(date, '10:00') });
    expect(res.status).toBe(201);
  });

  it('returns no slots and refuses a booking on the day after the last date', async () => {
    const [client, manicurist] = [await createClient(), await createManicurist()];
    await workEveryDay(manicurist.id);
    const date = addDays(horizonEnd(), 1);
    const serviceId = manicurist.profile!.services[0].id;

    const list = await slots(manicurist.id, { serviceId, date });
    expect(list.status).toBe(200);
    expect(list.body).toEqual({ date, dayOff: false, slots: [], busy: [] });

    const res = await book(client, { manicuristId: manicurist.id, serviceId, startAt: slotAt(date, '10:00') });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SLOT_INVALID');
  });
});
