import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { authHeader } from '../helpers/auth.js';
import { nextWeekday, slotAt } from '../helpers/dates.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createBooking, createClient, createManicurist, createService } from '../helpers/factories.js';

beforeEach(() => resetDb());
afterAll(() => prisma.$disconnect());

const MONDAY = 1;

describe('GET /api/manicurists', () => {
  const search = (query: object = {}) => request(app).get('/api/manicurists').query(query);
  const names = (res: request.Response) => res.body.manicurists.map((m: { name: string }) => m.name);

  it('returns every manicurist by name, with their active services by name', async () => {
    const plovdiv = await createManicurist({ name: 'Петя Димова', city: 'Пловдив' });
    const sofia = await createManicurist({ name: 'Ана Петрова', city: 'София' });
    const gel = await createService(sofia, { name: 'Гел лак', durationMin: 90, priceCents: 4000 });
    await createClient({ name: 'Борис Клиент' });

    const res = await search();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      manicurists: [
        {
          id: sofia.id,
          name: 'Ана Петрова',
          city: 'София',
          imageUrl: null,
          services: [
            { id: gel.id, name: 'Гел лак', durationMin: 90, priceCents: 4000 },
            { id: sofia.profile!.services[0].id, name: 'Класически маникюр', durationMin: 60, priceCents: 2500 },
          ],
        },
        {
          id: plovdiv.id,
          name: 'Петя Димова',
          city: 'Пловдив',
          imageUrl: null,
          services: [{ id: plovdiv.profile!.services[0].id, name: 'Класически маникюр', durationMin: 60, priceCents: 2500 }],
        },
      ],
    });
  });

  it('finds "София" when searching for "софия"', async () => {
    await createManicurist({ name: 'Ана', city: 'София' });
    await createManicurist({ name: 'Петя', city: 'Пловдив' });

    const res = await search({ city: 'софия' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Ана']);
  });

  it('filters by part of a service name, ignoring case', async () => {
    const ana = await createManicurist({ name: 'Ана' });
    await createManicurist({ name: 'Петя' });
    await createService(ana, { name: 'Гел лак' });

    const res = await search({ service: 'ГЕЛ' });

    expect(names(res)).toEqual(['Ана']);
  });

  it('applies the city and the service filter together', async () => {
    const sofiaGel = await createManicurist({ name: 'Ана', city: 'София' });
    const plovdivGel = await createManicurist({ name: 'Петя', city: 'Пловдив' });
    await createManicurist({ name: 'Мария', city: 'София' });
    await createService(sofiaGel, { name: 'Гел лак' });
    await createService(plovdivGel, { name: 'Гел лак' });

    const res = await search({ city: 'софия', service: 'гел' });

    expect(names(res)).toEqual(['Ана']);
  });

  it('treats an empty or blank parameter as no filter', async () => {
    await createManicurist({ name: 'Ана', city: 'София' });
    await createManicurist({ name: 'Петя', city: 'Пловдив' });

    const res = await search({ city: '   ', service: '' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Ана', 'Петя']);
  });

  it('neither shows nor finds a removed service', async () => {
    const ana = await createManicurist({ name: 'Ана' });
    await createService(ana, { name: 'Гел лак', deletedAt: new Date() });

    const all = await search();
    const byService = await search({ service: 'гел' });

    expect(all.body.manicurists[0].services.map((s: { name: string }) => s.name)).toEqual(['Класически маникюр']);
    expect(byService.body.manicurists).toEqual([]);
  });

  it('shows a new manicurist only while they have an active service', async () => {
    await createManicurist({ name: 'Петя', city: 'Бургас' });
    const registered = await request(app).post('/api/auth/register').send({
      email: 'ana.new@example.com',
      password: 'secret-password',
      name: 'Ана Нова',
      role: 'MANICURIST',
      city: 'Бургас',
      address: 'ул. Морска 3',
    });
    expect(registered.status).toBe(201);
    const auth = { Authorization: `Bearer ${registered.body.token}` };

    const beforeService = await search({ city: 'бургас' });
    const created = await request(app).post('/api/me/services').set(auth).send(serviceBody);
    expect(created.status).toBe(201);
    const withService = await search({ city: 'бургас' });
    const removed = await request(app).delete(`/api/me/services/${created.body.service.id}`).set(auth);
    expect(removed.status).toBe(204);
    const afterRemoval = await search({ city: 'бургас' });

    expect(names(beforeService)).toEqual(['Петя']);
    expect(names(withService)).toEqual(['Ана Нова', 'Петя']);
    expect(afterRemoval.status).toBe(200);
    expect(names(afterRemoval)).toEqual(['Петя']);
  });

  it('leaves out a manicurist whose services are all removed, even without filters', async () => {
    const ana = await createManicurist({ name: 'Ана' });
    await createManicurist({ name: 'Петя' });
    await createService(ana, { name: 'Гел лак', deletedAt: new Date() });
    await prisma.service.updateMany({ where: { manicuristId: ana.id }, data: { deletedAt: new Date() } });

    const res = await search();

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Петя']);
  });

  it('returns 400 VALIDATION_ERROR when a parameter is repeated', async () => {
    const res = await request(app).get('/api/manicurists?city=София&city=Пловдив');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/manicurists/:id', () => {
  const profile = (id: number | string) => request(app).get(`/api/manicurists/${id}`);

  it('returns the public profile with services by name and hours by weekday', async () => {
    const manicurist = await createManicurist({
      name: 'Ана Петрова',
      phone: '0888123456',
      city: 'София',
      address: 'ул. Розова 5',
      bio: 'Десет години опит.',
    });
    const gel = await createService(manicurist, { name: 'Гел лак', description: 'С изграждане.' });

    const res = await profile(manicurist.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      manicurist: {
        id: manicurist.id,
        name: 'Ана Петрова',
        email: manicurist.email,
        phone: '0888123456',
        city: 'София',
        address: 'ул. Розова 5',
        bio: 'Десет години опит.',
        imageUrl: null,
        services: [
          { id: gel.id, name: 'Гел лак', description: 'С изграждане.', durationMin: 90, priceCents: 4000 },
          {
            id: manicurist.profile!.services[0].id,
            name: 'Класически маникюр',
            description: null,
            durationMin: 60,
            priceCents: 2500,
          },
        ],
        workingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 540, endMin: 1080 })),
      },
    });
  });

  it('leaves out a removed service', async () => {
    const manicurist = await createManicurist();
    await createService(manicurist, { name: 'Гел лак', deletedAt: new Date() });

    const res = await profile(manicurist.id);

    expect(res.body.manicurist.services.map((s: { name: string }) => s.name)).toEqual(['Класически маникюр']);
  });

  it('returns 404 NOT_FOUND for a client or an unknown id', async () => {
    const client = await createClient();

    const forClient = await profile(client.id);
    const unknown = await profile(999999);

    expect(forClient.status).toBe(404);
    expect(forClient.body.error.code).toBe('NOT_FOUND');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for an id that is not a number', async () => {
    const res = await profile('abc');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/me/profile', () => {
  const body = {
    name: '  Ана Иванова ',
    phone: '0899000111',
    city: 'Пловдив',
    address: 'ул. Нова 2',
    bio: 'Нова биография.',
  };
  const put = (user: Parameters<typeof authHeader>[0], data: object) =>
    request(app).put('/api/me/profile').set(authHeader(user)).send(data);

  it('saves name and phone in the user and the rest in the profile', async () => {
    const manicurist = await createManicurist();

    const res = await put(manicurist, body);

    expect(res.status).toBe(200);
    expect(res.body.manicurist).toMatchObject({
      id: manicurist.id,
      name: 'Ана Иванова',
      email: manicurist.email,
      phone: '0899000111',
      city: 'Пловдив',
      address: 'ул. Нова 2',
      bio: 'Нова биография.',
      imageUrl: null,
    });
    expect(res.body.manicurist.services).toHaveLength(1);
    expect(res.body.manicurist.workingHours).toHaveLength(5);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: manicurist.id }, include: { profile: true } });
    expect(user).toMatchObject({ name: 'Ана Иванова', phone: '0899000111' });
    expect(user.profile).toMatchObject({ city: 'Пловдив', address: 'ул. Нова 2', bio: 'Нова биография.' });
  });

  it('saves a missing bio as an empty string, as registration does', async () => {
    const manicurist = await createManicurist({ bio: 'Стара.' });
    const { bio: _, ...withoutBio } = body;

    const res = await put(manicurist, withoutBio);

    expect(res.status).toBe(200);
    expect(res.body.manicurist.bio).toBe('');
  });

  it('saves a missing phone as an empty string, as registration does', async () => {
    const manicurist = await createManicurist();
    const { phone: _, ...withoutPhone } = body;

    const res = await put(manicurist, withoutPhone);

    expect(res.status).toBe(200);
    expect(res.body.manicurist.phone).toBe('');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: manicurist.id } });
    expect(user.phone).toBe('');
  });

  it('returns 400 VALIDATION_ERROR for a blank name or a missing city', async () => {
    const manicurist = await createManicurist();
    const { city: _, ...withoutCity } = body;

    const blankName = await put(manicurist, { ...body, name: '   ' });
    const noCity = await put(manicurist, withoutCity);

    expect(blankName.status).toBe(400);
    expect(blankName.body.error.code).toBe('VALIDATION_ERROR');
    expect(noCity.status).toBe(400);
    expect(noCity.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/me/profile').send(body);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const client = await createClient();

    const res = await put(client, body);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

const serviceBody = { name: '  Гел лак ', description: '  С изграждане. ', durationMin: 90, priceCents: 4000 };

// Each one breaks a single rule of the service body.
const invalidServiceBodies = {
  'a blank name': { ...serviceBody, name: '   ' },
  'a name over 80 characters': { ...serviceBody, name: 'а'.repeat(81) },
  'a description over 300 characters': { ...serviceBody, description: 'а'.repeat(301) },
  'a duration that is not a multiple of 5': { ...serviceBody, durationMin: 42 },
  'a duration of 0': { ...serviceBody, durationMin: 0 },
  'a duration under 15 (10, a multiple of 5)': { ...serviceBody, durationMin: 10 },
  'a duration over 480': { ...serviceBody, durationMin: 495 },
  'a negative price': { ...serviceBody, priceCents: -1 },
  'a price over 100000': { ...serviceBody, priceCents: 100001 },
  'a price that is not whole cents': { ...serviceBody, priceCents: 12.5 },
};

describe('POST /api/me/services', () => {
  const post = (user: Parameters<typeof authHeader>[0], data: object) =>
    request(app).post('/api/me/services').set(authHeader(user)).send(data);

  it('creates a service of the manicurist', async () => {
    const manicurist = await createManicurist();

    const res = await post(manicurist, serviceBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      service: { id: expect.any(Number), name: 'Гел лак', description: 'С изграждане.', durationMin: 90, priceCents: 4000 },
    });
    const row = await prisma.service.findUniqueOrThrow({ where: { id: res.body.service.id } });
    expect(row.manicuristId).toBe(manicurist.id);
    expect(row.deletedAt).toBeNull();
  });

  it('saves an empty or missing description as null', async () => {
    const manicurist = await createManicurist();
    const { description: _, ...withoutDescription } = serviceBody;

    const empty = await post(manicurist, { ...serviceBody, description: '   ' });
    const missing = await post(manicurist, withoutDescription);

    expect(empty.status).toBe(201);
    expect(empty.body.service.description).toBeNull();
    expect(missing.status).toBe(201);
    expect(missing.body.service.description).toBeNull();
  });

  it('accepts a duration of 40 minutes (a multiple of 5) and rejects 42 with 400 VALIDATION_ERROR', async () => {
    const manicurist = await createManicurist();

    const forty = await post(manicurist, { ...serviceBody, durationMin: 40 });
    const fortyTwo = await post(manicurist, { ...serviceBody, durationMin: 42 });

    expect(forty.status).toBe(201);
    expect(forty.body.service.durationMin).toBe(40);
    expect(fortyTwo.status).toBe(400);
    expect(fortyTwo.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts the edge values: 15 and 480 minutes, 0 and 100000 cents', async () => {
    const manicurist = await createManicurist();

    const shortest = await post(manicurist, { ...serviceBody, durationMin: 15, priceCents: 0 });
    const longest = await post(manicurist, { ...serviceBody, durationMin: 480, priceCents: 100000 });

    expect(shortest.status).toBe(201);
    expect(longest.status).toBe(201);
  });

  it.each(Object.entries(invalidServiceBodies))('returns 400 VALIDATION_ERROR for %s', async (_, data) => {
    const manicurist = await createManicurist();

    const res = await post(manicurist, data);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/me/services').send(serviceBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const client = await createClient();

    const res = await post(client, serviceBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('PUT /api/me/services/:id', () => {
  const put = (user: Parameters<typeof authHeader>[0], id: number | string, data: object) =>
    request(app).put(`/api/me/services/${id}`).set(authHeader(user)).send(data);

  it('updates the service and keeps the snapshot in old bookings', async () => {
    const manicurist = await createManicurist();
    const client = await createClient();
    const service = manicurist.profile!.services[0];
    const booking = await createBooking(client, manicurist);

    const res = await put(manicurist, service.id, serviceBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      service: { id: service.id, name: 'Гел лак', description: 'С изграждане.', durationMin: 90, priceCents: 4000 },
    });
    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(kept).toMatchObject({ serviceName: 'Класически маникюр', priceCents: 2500 });
  });

  it('returns 400 VALIDATION_ERROR for an invalid body', async () => {
    const manicurist = await createManicurist();

    const res = await put(manicurist, manicurist.profile!.services[0].id, invalidServiceBodies['a duration that is not a multiple of 5']);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const manicurist = await createManicurist();

    const res = await request(app).put(`/api/me/services/${manicurist.profile!.services[0].id}`).send(serviceBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const manicurist = await createManicurist();
    const client = await createClient();

    const res = await put(client, manicurist.profile!.services[0].id, serviceBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it("returns 403 FORBIDDEN for another manicurist's service and leaves it unchanged", async () => {
    const owner = await createManicurist();
    const other = await createManicurist();
    const service = owner.profile!.services[0];

    const res = await put(other, service.id, serviceBody);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const row = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(row.name).toBe('Класически маникюр');
  });

  it('returns 404 NOT_FOUND for a removed or an unknown service', async () => {
    const manicurist = await createManicurist();
    const removed = await createService(manicurist, { deletedAt: new Date() });

    const forRemoved = await put(manicurist, removed.id, serviceBody);
    const unknown = await put(manicurist, 999999, serviceBody);

    expect(forRemoved.status).toBe(404);
    expect(forRemoved.body.error.code).toBe('NOT_FOUND');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/me/services/:id', () => {
  const remove = (user: Parameters<typeof authHeader>[0], id: number | string) =>
    request(app).delete(`/api/me/services/${id}`).set(authHeader(user));

  it('keeps the row with deletedAt, and old bookings keep their serviceName', async () => {
    const manicurist = await createManicurist();
    const client = await createClient();
    const service = manicurist.profile!.services[0];
    await createBooking(client, manicurist);

    const res = await remove(manicurist, service.id);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const row = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(row.deletedAt).toBeInstanceOf(Date);
    const mine = await request(app).get('/api/bookings/mine').set(authHeader(client));
    expect(mine.body.upcoming[0]).toMatchObject({ serviceId: service.id, serviceName: 'Класически маникюр', status: 'BOOKED' });
  });

  it('makes slots and booking answer 404 NOT_FOUND for the removed service', async () => {
    const manicurist = await createManicurist();
    const client = await createClient();
    const service = manicurist.profile!.services[0];
    const date = nextWeekday(MONDAY);
    await remove(manicurist, service.id);

    const slots = await request(app)
      .get(`/api/manicurists/${manicurist.id}/slots`)
      .query({ serviceId: service.id, date });
    const booking = await request(app)
      .post('/api/bookings')
      .set(authHeader(client))
      .send({ manicuristId: manicurist.id, serviceId: service.id, startAt: slotAt(date, '10:00') });

    expect(slots.status).toBe(404);
    expect(slots.body.error.code).toBe('NOT_FOUND');
    expect(booking.status).toBe(404);
    expect(booking.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for an id that is not a number', async () => {
    const manicurist = await createManicurist();

    const res = await remove(manicurist, 'abc');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const manicurist = await createManicurist();

    const res = await request(app).delete(`/api/me/services/${manicurist.profile!.services[0].id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const manicurist = await createManicurist();
    const client = await createClient();

    const res = await remove(client, manicurist.profile!.services[0].id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it("returns 403 FORBIDDEN for another manicurist's service and does not remove it", async () => {
    const owner = await createManicurist();
    const other = await createManicurist();
    const service = owner.profile!.services[0];

    const res = await remove(other, service.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const row = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(row.deletedAt).toBeNull();
  });

  it('returns 404 NOT_FOUND for an already removed or an unknown service', async () => {
    const manicurist = await createManicurist();
    const removed = await createService(manicurist, { deletedAt: new Date() });

    const forRemoved = await remove(manicurist, removed.id);
    const unknown = await remove(manicurist, 999999);

    expect(forRemoved.status).toBe(404);
    expect(forRemoved.body.error.code).toBe('NOT_FOUND');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /api/me/working-hours', () => {
  const put = (user: Parameters<typeof authHeader>[0], data: object) =>
    request(app).put('/api/me/working-hours').set(authHeader(user)).send(data);
  const hoursOf = (manicuristId: number) =>
    prisma.workingHours.findMany({
      where: { manicuristId },
      orderBy: { weekday: 'asc' },
      select: { weekday: true, startMin: true, endMin: true },
    });

  it('replaces every day and returns the new hours by weekday', async () => {
    const manicurist = await createManicurist();
    const workingHours = [
      { weekday: 6, startMin: 600, endMin: 840 },
      { weekday: 1, startMin: 720, endMin: 1200 },
    ];

    const res = await put(manicurist, { workingHours });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      workingHours: [
        { weekday: 1, startMin: 720, endMin: 1200 },
        { weekday: 6, startMin: 600, endMin: 840 },
      ],
    });
    expect(await hoursOf(manicurist.id)).toEqual(res.body.workingHours);
  });

  it('accepts a day from 00:00 to 24:00', async () => {
    const manicurist = await createManicurist();

    const res = await put(manicurist, { workingHours: [{ weekday: 0, startMin: 0, endMin: 1440 }] });

    expect(res.status).toBe(200);
  });

  it('clears every day for an empty list', async () => {
    const manicurist = await createManicurist();

    const res = await put(manicurist, { workingHours: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ workingHours: [] });
    expect(await hoursOf(manicurist.id)).toEqual([]);
  });

  it('leaves the hours of other manicurists alone', async () => {
    const manicurist = await createManicurist();
    const other = await createManicurist();

    await put(manicurist, { workingHours: [] });

    expect(await hoursOf(other.id)).toHaveLength(5);
  });

  it('makes the slots follow the new hours', async () => {
    const manicurist = await createManicurist();
    const service = manicurist.profile!.services[0];
    const date = nextWeekday(MONDAY);

    await put(manicurist, { workingHours: [{ weekday: MONDAY, startMin: 720, endMin: 840 }] });
    const res = await request(app)
      .get(`/api/manicurists/${manicurist.id}/slots`)
      .query({ serviceId: service.id, date });

    // 60 minutes inside 12:00–14:00.
    expect(res.body.slots).toEqual([slotAt(date, '12:00'), slotAt(date, '12:30'), slotAt(date, '13:00')]);
  });

  it('keeps existing bookings even when they fall outside the new hours', async () => {
    const manicurist = await createManicurist();
    const client = await createClient();
    const booking = await createBooking(client, manicurist);

    const res = await put(manicurist, { workingHours: [{ weekday: MONDAY, startMin: 720, endMin: 840 }] });

    expect(res.status).toBe(200);
    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(kept.status).toBe('BOOKED');
  });

  it.each([
    ['a start off the 30-minute grid (09:15)', [{ weekday: 1, startMin: 555, endMin: 1080 }]],
    ['an end off the 30-minute grid', [{ weekday: 1, startMin: 540, endMin: 1065 }]],
    ['an end before the start', [{ weekday: 1, startMin: 1080, endMin: 540 }]],
    ['an end equal to the start', [{ weekday: 1, startMin: 540, endMin: 540 }]],
    ['an end after 24:00', [{ weekday: 1, startMin: 540, endMin: 1470 }]],
    ['a negative start', [{ weekday: 1, startMin: -30, endMin: 540 }]],
    ['a weekday over 6', [{ weekday: 7, startMin: 540, endMin: 1080 }]],
    [
      'a repeated weekday',
      [
        { weekday: 1, startMin: 540, endMin: 720 },
        { weekday: 1, startMin: 780, endMin: 1080 },
      ],
    ],
  ])('returns 400 VALIDATION_ERROR for %s and keeps the old hours', async (_, workingHours) => {
    const manicurist = await createManicurist();

    const res = await put(manicurist, { workingHours });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await hoursOf(manicurist.id)).toHaveLength(5);
  });

  it('returns 400 VALIDATION_ERROR without the workingHours list', async () => {
    const manicurist = await createManicurist();

    const res = await put(manicurist, {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/me/working-hours').send({ workingHours: [] });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for a client', async () => {
    const client = await createClient();

    const res = await put(client, { workingHours: [] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
