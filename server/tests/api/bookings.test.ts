import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { addDays } from '../../src/lib/time.js';
import { authHeader } from '../helpers/auth.js';
import { daysAgo, nextWeekday, slotAt } from '../helpers/dates.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createBooking, createClient, createDayOff, createManicurist, createService } from '../helpers/factories.js';

beforeEach(() => resetDb());
afterAll(() => prisma.$disconnect());

const MONDAY = 1;
const SATURDAY = 6;

// A UTC start on a past Sofia date, for bookings the API must treat as past.
const pastStart = (time = '10:00') => new Date(slotAt(daysAgo(7), time));

async function setup() {
  const client = await createClient();
  const manicurist = await createManicurist();
  const service = manicurist.profile!.services[0];
  return { client, manicurist, service };
}

describe('GET /api/manicurists/:id/slots', () => {
  const slots = (manicuristId: number, query: object) =>
    request(app).get(`/api/manicurists/${manicuristId}/slots`).query(query);

  it('returns every free start of a normal working day', async () => {
    const { manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(date);
    expect(res.body.dayOff).toBe(false);
    // 60 minutes inside 09:00–18:00: 09:00, 09:30, ..., 17:00.
    expect(res.body.slots).toHaveLength(17);
    expect(res.body.slots[0]).toBe(slotAt(date, '09:00'));
    expect(res.body.slots.at(-1)).toBe(slotAt(date, '17:00'));
  });

  it('drops the starts that overlap a booking, but not a cancelled one', async () => {
    const { client, manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });
    await createBooking(client, manicurist, {
      startAt: new Date(slotAt(date, '14:00')),
      status: 'CANCELLED',
      cancelledBy: 'CLIENT',
      cancelReason: 'Разболях се.',
    });

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.body.slots).not.toContain(slotAt(date, '09:30'));
    expect(res.body.slots).not.toContain(slotAt(date, '10:00'));
    expect(res.body.slots).not.toContain(slotAt(date, '10:30'));
    expect(res.body.slots).toContain(slotAt(date, '09:00'));
    expect(res.body.slots).toContain(slotAt(date, '11:00'));
    expect(res.body.slots).toContain(slotAt(date, '14:00'));
  });

  it('returns dayOff true and no slots on a day off', async () => {
    const { manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);
    await createDayOff(manicurist, date);

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date, dayOff: true, slots: [], busy: [] });
  });

  it('ignores a removed day off', async () => {
    const { manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);
    await createDayOff(manicurist, date, { deletedAt: new Date() });

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.body.dayOff).toBe(false);
    expect(res.body.slots).toHaveLength(17);
  });

  it('returns no slots on a weekday without working hours', async () => {
    const { manicurist, service } = await setup();
    const date = nextWeekday(SATURDAY);

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date, dayOff: false, slots: [], busy: [] });
  });

  it('lists the busy intervals of the day by start time, with only startAt and endAt, cancelled ones left out', async () => {
    const { client, manicurist, service } = await setup();
    const short = await createService(manicurist, { name: 'Сваляне', durationMin: 40 });
    const date = nextWeekday(MONDAY);
    // Created out of order, so the order in busy comes from startAt.
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '14:00')) });
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:30')), service: short });
    await createBooking(client, manicurist, {
      startAt: new Date(slotAt(date, '16:00')),
      status: 'CANCELLED',
      cancelledBy: 'CLIENT',
      cancelReason: 'Разболях се.',
    });
    // Another date and another manicurist stay out.
    await createBooking(client, manicurist, { startAt: new Date(slotAt(addDays(date, 1), '10:00')) });
    await createBooking(client, await createManicurist(), { startAt: new Date(slotAt(date, '12:00')) });

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.status).toBe(200);
    expect(res.body.busy).toEqual([
      { startAt: slotAt(date, '10:30'), endAt: slotAt(date, '11:10') },
      { startAt: slotAt(date, '14:00'), endAt: slotAt(date, '15:00') },
    ]);
  });

  it('offers the end of a 40-minute booking as a start, between the grid starts', async () => {
    const { client, manicurist, service } = await setup();
    const short = await createService(manicurist, { name: 'Сваляне', durationMin: 40 });
    const date = nextWeekday(MONDAY);
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:30')), service: short });

    const res = await slots(manicurist.id, { serviceId: service.id, date });

    expect(res.status).toBe(200);
    // 60 minutes: 09:00, 09:30, then 11:10 (the booking end) and the grid from 11:30.
    expect(res.body.slots.slice(0, 4)).toEqual([
      slotAt(date, '09:00'),
      slotAt(date, '09:30'),
      slotAt(date, '11:10'),
      slotAt(date, '11:30'),
    ]);
    expect(res.body.slots).not.toContain(slotAt(date, '11:00'));
    expect(res.body.slots).toHaveLength(15);
  });

  it('returns the busy intervals and no slots without a serviceId', async () => {
    const { client, manicurist } = await setup();
    const date = nextWeekday(MONDAY);
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });

    const res = await slots(manicurist.id, { date });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      date,
      dayOff: false,
      slots: [],
      busy: [{ startAt: slotAt(date, '10:00'), endAt: slotAt(date, '11:00') }],
    });
  });

  it('returns dayOff true and nothing busy without a serviceId on a day off', async () => {
    const { manicurist } = await setup();
    const date = nextWeekday(MONDAY);
    await createDayOff(manicurist, date);

    const res = await slots(manicurist.id, { date });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date, dayOff: true, slots: [], busy: [] });
  });

  it('returns 404 NOT_FOUND without a serviceId for an unknown manicurist or a client', async () => {
    const { client, manicurist } = await setup();
    const date = nextWeekday(MONDAY);

    for (const id of [manicurist.id + 1000, client.id]) {
      const res = await slots(id, { date });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns 400 VALIDATION_ERROR for a bad or missing query', async () => {
    const { manicurist, service } = await setup();

    for (const query of [
      { serviceId: service.id, date: '02.11.2026' },
      { serviceId: service.id, date: '2026-02-30' },
      { serviceId: service.id },
      {},
    ]) {
      const res = await slots(manicurist.id, query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns 404 NOT_FOUND for a service of another manicurist or an unknown manicurist', async () => {
    const { manicurist } = await setup();
    const other = await createManicurist();
    const otherService = other.profile!.services[0];
    const date = nextWeekday(MONDAY);

    const foreign = await slots(manicurist.id, { serviceId: otherService.id, date });
    const unknown = await slots(other.id + 1000, { serviceId: otherService.id, date });

    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/bookings', () => {
  const book = (user: Parameters<typeof authHeader>[0] | null, body: object) => {
    const req = request(app).post('/api/bookings');
    return (user ? req.set(authHeader(user)) : req).send(body);
  };

  it('returns 201 with the booking, its endAt and the service snapshot', async () => {
    const { client, manicurist, service } = await setup();
    const startAt = slotAt(nextWeekday(MONDAY), '10:00');

    const res = await book(client, { manicuristId: manicurist.id, serviceId: service.id, startAt });

    expect(res.status).toBe(201);
    expect(res.body.booking).toEqual({
      id: expect.any(Number),
      startAt,
      endAt: new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString(),
      status: 'BOOKED',
      cancelledBy: null,
      cancelReason: null,
      serviceId: service.id,
      serviceName: service.name,
      priceCents: service.priceCents,
      client: { id: client.id, name: client.name, phone: client.phone },
      manicurist: {
        id: manicurist.id,
        name: manicurist.name,
        phone: manicurist.phone,
        city: manicurist.profile!.city,
        address: manicurist.profile!.address,
      },
    });
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: res.body.booking.id } });
    expect(saved).toMatchObject({ clientId: client.id, manicuristId: manicurist.id, serviceId: service.id });
  });

  it('returns 201 for a start exactly at the end of a 40-minute booking, with endAt = start + duration', async () => {
    const { client, manicurist, service } = await setup();
    const short = await createService(manicurist, { name: 'Сваляне', durationMin: 40 });
    const date = nextWeekday(MONDAY);
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:30')), service: short });

    const res = await book(client, {
      manicuristId: manicurist.id,
      serviceId: service.id,
      startAt: slotAt(date, '11:10'),
    });

    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ startAt: slotAt(date, '11:10'), endAt: slotAt(date, '12:10') });
  });

  it('returns 400 SLOT_INVALID for an off-grid start once the booking that ended there is cancelled', async () => {
    const { client, manicurist, service } = await setup();
    const short = await createService(manicurist, { name: 'Сваляне', durationMin: 40 });
    const date = nextWeekday(MONDAY);
    const before = await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:30')), service: short });
    const slotsOf = () => request(app).get(`/api/manicurists/${manicurist.id}/slots`).query({ serviceId: service.id, date });

    expect((await slotsOf()).body.slots).toContain(slotAt(date, '11:10'));
    const cancelled = await request(app)
      .patch(`/api/bookings/${before.id}/cancel`)
      .set(authHeader(client))
      .send({ reason: 'Разболях се.' });
    expect(cancelled.status).toBe(200);
    expect((await slotsOf()).body.slots).not.toContain(slotAt(date, '11:10'));

    const res = await book(client, {
      manicuristId: manicurist.id,
      serviceId: service.id,
      startAt: slotAt(date, '11:10'),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SLOT_INVALID');
    expect(await prisma.booking.count({ where: { status: 'BOOKED' } })).toBe(0);
  });

  it('returns 409 SLOT_TAKEN when the slot overlaps an active booking', async () => {
    const { client, manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);
    await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '10:00')) });

    const res = await book(client, {
      manicuristId: manicurist.id,
      serviceId: service.id,
      startAt: slotAt(date, '10:30'),
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
  });

  it('books a slot freed by a cancelled booking', async () => {
    const { client, manicurist, service } = await setup();
    const startAt = slotAt(nextWeekday(MONDAY), '10:00');
    await createBooking(client, manicurist, {
      startAt: new Date(startAt),
      status: 'CANCELLED',
      cancelledBy: 'MANICURIST',
      cancelReason: 'Болна съм.',
    });

    const res = await book(client, { manicuristId: manicurist.id, serviceId: service.id, startAt });

    expect(res.status).toBe(201);
  });

  it('returns 409 DAY_OFF on a day off', async () => {
    const { client, manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);
    await createDayOff(manicurist, date);

    const res = await book(client, {
      manicuristId: manicurist.id,
      serviceId: service.id,
      startAt: slotAt(date, '10:00'),
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DAY_OFF');
  });

  it('returns 400 SLOT_INVALID off the grid, outside working hours or in the past', async () => {
    const { client, manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);

    for (const startAt of [
      slotAt(date, '10:15'),
      slotAt(date, '17:30'),
      slotAt(nextWeekday(SATURDAY), '10:00'),
      pastStart().toISOString(),
    ]) {
      const res = await book(client, { manicuristId: manicurist.id, serviceId: service.id, startAt });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SLOT_INVALID');
    }
  });

  it('returns 404 NOT_FOUND for a service of another manicurist', async () => {
    const { client, manicurist } = await setup();
    const other = await createManicurist();

    const res = await book(client, {
      manicuristId: manicurist.id,
      serviceId: other.profile!.services[0].id,
      startAt: slotAt(nextWeekday(MONDAY), '10:00'),
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for a bad body', async () => {
    const { client, manicurist, service } = await setup();
    const date = nextWeekday(MONDAY);

    for (const body of [
      {},
      { manicuristId: manicurist.id, serviceId: service.id },
      { manicuristId: manicurist.id, serviceId: service.id, startAt: `${date}T10:00` },
      { manicuristId: 'one', serviceId: service.id, startAt: slotAt(date, '10:00') },
    ]) {
      const res = await book(client, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns 401 without a token', async () => {
    const { manicurist, service } = await setup();

    const res = await book(null, {
      manicuristId: manicurist.id,
      serviceId: service.id,
      startAt: slotAt(nextWeekday(MONDAY), '10:00'),
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a manicurist', async () => {
    const { manicurist, service } = await setup();

    const res = await book(manicurist, {
      manicuristId: manicurist.id,
      serviceId: service.id,
      startAt: slotAt(nextWeekday(MONDAY), '10:00'),
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets only one of two clients racing for the same slot book it', async () => {
    const { client, manicurist, service } = await setup();
    const rival = await createClient();
    const body = { manicuristId: manicurist.id, serviceId: service.id, startAt: slotAt(nextWeekday(MONDAY), '10:00') };

    const results = await Promise.all([book(client, body), book(rival, body)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('SLOT_TAKEN');
    expect(await prisma.booking.count()).toBe(1);
  });
});

describe('GET /api/bookings/mine', () => {
  const mine = (user: Parameters<typeof authHeader>[0] | null) => {
    const req = request(app).get('/api/bookings/mine');
    return user ? req.set(authHeader(user)) : req;
  };

  it('returns only own bookings, split into upcoming and past, cancelled ones included', async () => {
    const { client, manicurist } = await setup();
    const stranger = await createClient();
    const date = nextWeekday(MONDAY);
    const later = await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '15:00')) });
    const sooner = await createBooking(client, manicurist, {
      startAt: new Date(slotAt(date, '10:00')),
      status: 'CANCELLED',
      cancelledBy: 'MANICURIST',
      cancelReason: 'Болна съм.',
    });
    const older = await createBooking(client, manicurist, { startAt: pastStart('10:00') });
    const newer = await createBooking(client, manicurist, { startAt: new Date(slotAt(daysAgo(1), '10:00')) });
    await createBooking(stranger, manicurist, { startAt: new Date(slotAt(date, '12:00')) });

    const res = await mine(client);

    expect(res.status).toBe(200);
    expect(res.body.upcoming.map((b: { id: number }) => b.id)).toEqual([sooner.id, later.id]);
    expect(res.body.past.map((b: { id: number }) => b.id)).toEqual([newer.id, older.id]);
    expect(res.body.upcoming[0]).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'MANICURIST',
      cancelReason: 'Болна съм.',
      manicurist: { id: manicurist.id, name: manicurist.name },
    });
    expect(res.body.upcoming[0].client).not.toHaveProperty('email');
    expect(res.body.upcoming[0].manicurist).not.toHaveProperty('email');
  });

  it('keeps a booking that has started but not ended in upcoming', async () => {
    const { client, manicurist } = await setup();
    const started = await createBooking(client, manicurist, { startAt: new Date(Date.now() - 10 * 60_000) });

    const res = await mine(client);

    expect(res.body.upcoming.map((b: { id: number }) => b.id)).toEqual([started.id]);
    expect(res.body.past).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const res = await mine(null);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a manicurist', async () => {
    const { manicurist } = await setup();

    const res = await mine(manicurist);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/bookings/schedule', () => {
  const schedule = (user: Parameters<typeof authHeader>[0] | null, query: object = {}) => {
    const req = request(app).get('/api/bookings/schedule').query(query);
    return user ? req.set(authHeader(user)) : req;
  };

  it("returns the manicurist's own bookings on that date in order, cancelled ones included", async () => {
    const { client, manicurist } = await setup();
    const other = await createManicurist();
    const date = nextWeekday(MONDAY);
    const afternoon = await createBooking(client, manicurist, { startAt: new Date(slotAt(date, '15:00')) });
    const morning = await createBooking(client, manicurist, {
      startAt: new Date(slotAt(date, '09:00')),
      status: 'CANCELLED',
      cancelledBy: 'CLIENT',
      cancelReason: 'Разболях се.',
    });
    await createBooking(client, manicurist, { startAt: new Date(slotAt(addDays(date, 1), '10:00')) });
    await createBooking(client, other, { startAt: new Date(slotAt(date, '10:00')) });

    const res = await schedule(manicurist, { date });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(date);
    expect(res.body.bookings.map((b: { id: number }) => b.id)).toEqual([morning.id, afternoon.id]);
    expect(res.body.bookings[0]).toMatchObject({
      cancelledBy: 'CLIENT',
      cancelReason: 'Разболях се.',
      client: { id: client.id, name: client.name, phone: client.phone },
    });
  });

  it('returns 400 VALIDATION_ERROR for a bad or missing date', async () => {
    const { manicurist } = await setup();

    for (const query of [{}, { date: '2026-13-01' }]) {
      const res = await schedule(manicurist, query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns 401 without a token', async () => {
    const res = await schedule(null, { date: nextWeekday(MONDAY) });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const { client } = await setup();

    const res = await schedule(client, { date: nextWeekday(MONDAY) });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('PATCH /api/bookings/:id/cancel', () => {
  const cancel = (user: Parameters<typeof authHeader>[0] | null, id: number | string, body: object) => {
    const req = request(app).patch(`/api/bookings/${id}/cancel`);
    return (user ? req.set(authHeader(user)) : req).send(body);
  };

  it('lets the client cancel with a reason', async () => {
    const { client, manicurist } = await setup();
    const booking = await createBooking(client, manicurist);

    const res = await cancel(client, booking.id, { reason: '  Разболях се.  ' });

    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({
      id: booking.id,
      status: 'CANCELLED',
      cancelledBy: 'CLIENT',
      cancelReason: 'Разболях се.',
    });
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved).toMatchObject({ status: 'CANCELLED', cancelledBy: 'CLIENT', cancelReason: 'Разболях се.' });
  });

  it('lets the manicurist cancel with a reason', async () => {
    const { client, manicurist } = await setup();
    const booking = await createBooking(client, manicurist);

    const res = await cancel(manicurist, booking.id, { reason: 'Болна съм.' });

    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({ status: 'CANCELLED', cancelledBy: 'MANICURIST' });
  });

  it('returns 403 FORBIDDEN for someone who is not on the booking', async () => {
    const { client, manicurist } = await setup();
    const booking = await createBooking(client, manicurist);
    const strangers = [await createClient(), await createManicurist()];

    for (const stranger of strangers) {
      const res = await cancel(stranger, booking.id, { reason: 'Просто така.' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved.status).toBe('BOOKED');
  });

  it('returns 400 VALIDATION_ERROR without a reason, with a blank one or with one over 200 characters', async () => {
    const { client, manicurist } = await setup();
    const booking = await createBooking(client, manicurist);

    for (const body of [{}, { reason: '   ' }, { reason: 'а'.repeat(201) }]) {
      const res = await cancel(client, booking.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepts a reason of exactly 200 characters', async () => {
    const { client, manicurist } = await setup();
    const booking = await createBooking(client, manicurist);

    const res = await cancel(client, booking.id, { reason: 'а'.repeat(200) });

    expect(res.status).toBe(200);
  });

  it('returns 409 NOT_CANCELLABLE for a cancelled, past or started booking', async () => {
    const { client, manicurist } = await setup();
    const bookings = [
      await createBooking(client, manicurist, {
        status: 'CANCELLED',
        cancelledBy: 'CLIENT',
        cancelReason: 'Разболях се.',
      }),
      await createBooking(client, manicurist, { startAt: pastStart() }),
      await createBooking(client, manicurist, { startAt: new Date(Date.now() - 10 * 60_000) }),
    ];

    for (const booking of bookings) {
      const res = await cancel(client, booking.id, { reason: 'Разболях се.' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NOT_CANCELLABLE');
    }
  });

  it('returns 404 NOT_FOUND for an unknown booking and 400 for a bad id', async () => {
    const { client } = await setup();

    const unknown = await cancel(client, 999_999, { reason: 'Разболях се.' });
    const bad = await cancel(client, 'abc', { reason: 'Разболях се.' });

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const { client, manicurist } = await setup();
    const booking = await createBooking(client, manicurist);

    const res = await cancel(null, booking.id, { reason: 'Разболях се.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
