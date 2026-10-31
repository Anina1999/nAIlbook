// Studio coordinates: found with the geocoder on manicurist registration and
// on a profile save that changes the city or the address. Vitest runs the fake
// geocoder (GEOCODER=fake in vitest.config.ts): an address containing
// «ненамерен» is not found, one containing «недостъпен» makes it unavailable.
// The module is wrapped in a spy, so a test can check whether it was called;
// the spy still runs the real fake.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app.js';
import { geocode } from '../../src/lib/geocoder.js';
import { authHeader } from '../helpers/auth.js';
import { prisma, resetDb } from '../helpers/db.js';
import { createClient, createManicurist } from '../helpers/factories.js';

vi.mock('../../src/lib/geocoder.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/geocoder.js')>();
  return { ...actual, geocode: vi.fn(actual.geocode) };
});

const geocodeSpy = vi.mocked(geocode);

// What the fake answers, computed without going through the spy.
async function fakeCoordinates(address: string, city: string) {
  const actual = await vi.importActual<typeof import('../../src/lib/geocoder.js')>('../../src/lib/geocoder.js');
  const coordinates = await actual.geocode(address, city);
  expect(coordinates).not.toBeNull();
  return coordinates!;
}

beforeEach(async () => {
  geocodeSpy.mockClear();
  await resetDb();
});
afterAll(() => prisma.$disconnect());

const NOT_FOUND_ADDRESS = 'ул. Ненамерена 5';
const UNAVAILABLE_ADDRESS = 'ул. недостъпен път 3';

describe('POST /api/auth/register (studio coordinates)', () => {
  const manicurist = {
    email: 'maria@example.com',
    password: 'secret123',
    name: 'Мария Иванова',
    phone: '0888654321',
    role: 'MANICURIST',
    city: ' Пловдив ',
    address: '  ул. Главна 5 ',
    bio: 'Гел лак и маникюр.',
  };
  const register = (body: object) => request(app).post('/api/auth/register').send(body);
  const usersWithEmail = (email: string) => prisma.user.count({ where: { email } });

  it('geocodes the trimmed address and city and saves the coordinates in the profile', async () => {
    const expected = await fakeCoordinates('ул. Главна 5', 'Пловдив');

    const res = await register(manicurist);

    expect(res.status).toBe(201);
    expect(geocodeSpy).toHaveBeenCalledTimes(1);
    expect(geocodeSpy).toHaveBeenCalledWith('ул. Главна 5', 'Пловдив');
    const profile = await prisma.manicuristProfile.findUniqueOrThrow({ where: { userId: res.body.user.id } });
    expect(profile).toMatchObject(expected);

    const page = await request(app).get(`/api/manicurists/${res.body.user.id}`);
    expect(page.status).toBe(200);
    expect(page.body.manicurist).toMatchObject(expected);
  });

  it('returns 400 VALIDATION_ERROR on address when the address is not found, and creates no user', async () => {
    const res = await register({ ...manicurist, address: NOT_FOUND_ADDRESS });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ path: 'address', message: expect.any(String) }]);
    expect(await usersWithEmail(manicurist.email)).toBe(0);
    expect(await prisma.manicuristProfile.count()).toBe(0);
  });

  it('returns 503 GEOCODER_UNAVAILABLE when the geocoder is unavailable, and creates no user', async () => {
    const res = await register({ ...manicurist, address: UNAVAILABLE_ADDRESS });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GEOCODER_UNAVAILABLE');
    expect(await usersWithEmail(manicurist.email)).toBe(0);
    expect(await prisma.manicuristProfile.count()).toBe(0);
  });

  it('rejects an invalid body with 400 from zod before calling the geocoder', async () => {
    const { city: _, ...withoutCity } = manicurist;

    const res = await register(withoutCity);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual({ path: 'city', message: expect.any(String) });
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(await usersWithEmail(manicurist.email)).toBe(0);
  });

  it('returns 409 EMAIL_TAKEN for a taken email before calling the geocoder', async () => {
    await createClient({ email: manicurist.email });

    const res = await register(manicurist);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('never calls the geocoder for a client registration', async () => {
    const res = await register({
      email: 'ivana@example.com',
      password: 'secret123',
      name: 'Ивана Петрова',
      role: 'CLIENT',
    });

    expect(res.status).toBe(201);
    expect(geocodeSpy).not.toHaveBeenCalled();
  });
});

describe('PUT /api/me/profile (studio coordinates)', () => {
  // Coordinates no fake answer returns, so a call to the geocoder would show.
  const OLD_COORDINATES = { latitude: 42.5, longitude: 25.5 };
  const current = {
    name: 'Ана Петрова',
    phone: '0888123456',
    city: 'София',
    address: 'ул. Тестова 1',
    bio: 'Стара биография.',
  };
  const createOwn = () => createManicurist({ ...current, ...OLD_COORDINATES });
  const put = (user: Parameters<typeof authHeader>[0], data: object) =>
    request(app).put('/api/me/profile').set(authHeader(user)).send(data);
  const loadProfile = (userId: number) =>
    prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });

  it.each([
    ['the city', { city: 'Пловдив' }],
    ['the address', { address: 'ул. Нова 2' }],
  ])('geocodes again when %s changes and saves the new coordinates', async (_, change) => {
    const manicurist = await createOwn();
    const body = { ...current, ...change };
    const expected = await fakeCoordinates(body.address, body.city);

    const res = await put(manicurist, body);

    expect(res.status).toBe(200);
    expect(geocodeSpy).toHaveBeenCalledTimes(1);
    expect(geocodeSpy).toHaveBeenCalledWith(body.address, body.city);
    expect(res.body.manicurist).toMatchObject(expected);
    const saved = await loadProfile(manicurist.id);
    expect(saved.profile).toMatchObject({ city: body.city, address: body.address, ...expected });
    expect(expected).not.toEqual(OLD_COORDINATES);
  });

  it.each([
    ['is not found', NOT_FOUND_ADDRESS, 400, 'VALIDATION_ERROR'],
    ['cannot be checked', UNAVAILABLE_ADDRESS, 503, 'GEOCODER_UNAVAILABLE'],
  ])('leaves the profile, the name and the phone unchanged when the new address %s', async (_, address, status, code) => {
    const manicurist = await createOwn();

    const res = await put(manicurist, {
      name: 'Ново Име',
      phone: '0899000111',
      city: 'Варна',
      address,
      bio: 'Нова биография.',
    });

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    if (code === 'VALIDATION_ERROR') {
      expect(res.body.error.details).toEqual([{ path: 'address', message: expect.any(String) }]);
    }
    const saved = await loadProfile(manicurist.id);
    expect(saved).toMatchObject({ name: current.name, phone: current.phone });
    expect(saved.profile).toMatchObject({
      city: current.city,
      address: current.address,
      bio: current.bio,
      ...OLD_COORDINATES,
    });
  });

  it('keeps the coordinates and does not call the geocoder when the city and the address stay the same', async () => {
    const manicurist = await createOwn();

    const res = await put(manicurist, {
      ...current,
      name: 'Ново Име',
      bio: 'Нова биография.',
      // Trimmed by zod, so these are the same city and address.
      city: `  ${current.city} `,
      address: ` ${current.address}  `,
    });

    expect(res.status).toBe(200);
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(res.body.manicurist).toMatchObject({ name: 'Ново Име', bio: 'Нова биография.', ...OLD_COORDINATES });
    const saved = await loadProfile(manicurist.id);
    expect(saved.profile).toMatchObject({ bio: 'Нова биография.', ...OLD_COORDINATES });
  });

  it('rejects an invalid body with 400 from zod before calling the geocoder', async () => {
    const manicurist = await createOwn();
    const { address: _, ...withoutAddress } = current;

    const res = await put(manicurist, { ...withoutAddress, city: 'Пловдив' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('does not call the geocoder for a client, who gets 403 FORBIDDEN', async () => {
    const client = await createClient();

    const res = await put(client, { ...current, city: 'Пловдив' });

    expect(res.status).toBe(403);
    expect(geocodeSpy).not.toHaveBeenCalled();
  });
});
