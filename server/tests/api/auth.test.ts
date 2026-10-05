import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { requireAuth, requireRole } from '../../src/middleware/auth.js';
import { authHeader } from '../helpers/auth.js';
import { prisma, resetDb } from '../helpers/db.js';
import { TEST_PASSWORD, createClient, createManicurist } from '../helpers/factories.js';

beforeEach(() => resetDb());
afterAll(() => prisma.$disconnect());

const client = {
  email: 'ivana@example.com',
  password: 'secret123',
  name: 'Ивана Петрова',
  phone: '0888123456',
  role: 'CLIENT',
};

const manicurist = {
  email: 'maria@example.com',
  password: 'secret123',
  name: 'Мария Иванова',
  phone: '0888654321',
  role: 'MANICURIST',
  city: 'Пловдив',
  address: 'ул. Главна 5',
  bio: 'Гел лак и маникюр.',
};

const register = (body: object) => request(app).post('/api/auth/register').send(body);
const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });
const me = (token?: string) => {
  const req = request(app).get('/api/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('POST /api/auth/register', () => {
  it('registers a client and returns 201 with a token and the user', async () => {
    const res = await register(client);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(Number),
      email: 'ivana@example.com',
      name: 'Ивана Петрова',
      phone: '0888123456',
      role: 'CLIENT',
    });
    const profile = await prisma.manicuristProfile.findUnique({ where: { userId: res.body.user.id } });
    expect(profile).toBeNull();
  });

  it('registers a manicurist and creates the profile from city, address and bio', async () => {
    const res = await register(manicurist);

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('MANICURIST');
    const profile = await prisma.manicuristProfile.findUnique({ where: { userId: res.body.user.id } });
    expect(profile).toMatchObject({ city: 'Пловдив', address: 'ул. Главна 5', bio: 'Гел лак и маникюр.' });
  });

  it('accepts a manicurist without a bio and stores an empty one', async () => {
    const { bio: _, ...withoutBio } = manicurist;
    const res = await register(withoutBio);

    expect(res.status).toBe(201);
    const profile = await prisma.manicuristProfile.findUnique({ where: { userId: res.body.user.id } });
    expect(profile?.bio).toBe('');
  });

  it('stores the password as a bcrypt hash', async () => {
    const res = await register(client);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(user.passwordHash).not.toBe(client.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('returns 400 VALIDATION_ERROR with field details when a field is missing or invalid', async () => {
    const res = await register({ ...client, email: 'not-an-email', name: undefined, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'name', 'password']));
  });

  it('returns 400 VALIDATION_ERROR when the role is ADMIN', async () => {
    const res = await register({ ...client, role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.user.count()).toBe(0);
  });

  it('returns 400 VALIDATION_ERROR when a manicurist has no city or address', async () => {
    const res = await register({ ...manicurist, city: undefined, address: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['city', 'address']));
    expect(await prisma.user.count()).toBe(0);
  });

  it('returns 409 EMAIL_TAKEN when the email is already registered', async () => {
    await register(client);
    const res = await register({ ...manicurist, email: client.email });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('treats emails case-insensitively and trims them', async () => {
    await register(client);
    const res = await register({ ...client, email: '  IVANA@Example.com ' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 VALIDATION_ERROR for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with a token that works for /me', async () => {
    const user = await createClient();
    const res = await login(user.email, TEST_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email, role: 'CLIENT' });
    expect((await me(res.body.token)).status).toBe(200);
  });

  it('accepts the email in a different case', async () => {
    const user = await createClient();
    const res = await login(user.email.toUpperCase(), TEST_PASSWORD);

    expect(res.status).toBe(200);
  });

  it('returns 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const user = await createClient();
    const res = await login(user.email, 'wrong-password');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the same 401 INVALID_CREDENTIALS for an unknown email', async () => {
    const res = await login('nobody@example.com', TEST_PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 VALIDATION_ERROR when the password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const user = await createManicurist();
    const res = await request(app).get('/api/auth/me').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: 'MANICURIST',
    });
  });

  it('returns 401 UNAUTHORIZED without a token', async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED for a malformed token, a wrong signature or alg "none"', async () => {
    const user = await createClient();
    const payload = { role: user.role, tokenVersion: user.tokenVersion };
    const tokens = [
      'not-a-jwt',
      jwt.sign(payload, 'another-secret', { subject: String(user.id) }),
      jwt.sign(payload, '', { subject: String(user.id), algorithm: 'none' }),
    ];

    for (const token of tokens) {
      const res = await me(token);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns 401 UNAUTHORIZED for an expired token', async () => {
    const user = await createClient();
    const expired = jwt.sign(
      { role: user.role, tokenVersion: user.tokenVersion, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
      { subject: String(user.id), algorithm: 'HS256' },
    );
    const res = await me(expired);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when the user no longer exists', async () => {
    const user = await createClient();
    const header = authHeader(user);
    await prisma.user.delete({ where: { id: user.id } });
    const res = await request(app).get('/api/auth/me').set(header);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 204, and the old token gets 401 on /me afterwards', async () => {
    const user = await createClient();
    const { token } = (await login(user.email, TEST_PASSWORD)).body;

    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const after = await me(token);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('UNAUTHORIZED');
  });

  it('signs out every token of the user, not only the one used for logout', async () => {
    const user = await createClient();
    const first = (await login(user.email, TEST_PASSWORD)).body.token;
    const second = (await login(user.email, TEST_PASSWORD)).body.token;

    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first}`);

    expect((await me(second)).status).toBe(401);
  });

  it('gives a working token on the next login', async () => {
    const user = await createClient();
    const old = (await login(user.email, TEST_PASSWORD)).body.token;
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${old}`);

    const fresh = (await login(user.email, TEST_PASSWORD)).body.token;

    expect((await me(fresh)).status).toBe(200);
  });

  it('returns 401 UNAUTHORIZED without a token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('requireRole', () => {
  // A test-only router: the app has no manicurist-only endpoint yet.
  const guarded = express()
    .get('/manicurist-only', requireAuth, requireRole('MANICURIST'), (_req, res) => {
      res.json({ ok: true });
    })
    .use(errorHandler);

  it('returns 403 FORBIDDEN for the wrong role', async () => {
    const user = await createClient();
    const res = await request(guarded).get('/manicurist-only').set(authHeader(user));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets the right role through', async () => {
    const user = await createManicurist();
    const res = await request(guarded).get('/manicurist-only').set(authHeader(user));

    expect(res.status).toBe(200);
  });

  it('returns 401 UNAUTHORIZED before the role check when there is no token', async () => {
    const res = await request(guarded).get('/manicurist-only');

    expect(res.status).toBe(401);
  });
});

describe('responses never leak secrets', () => {
  it('register, login and /me do not contain passwordHash or tokenVersion', async () => {
    const registered = await register(manicurist);
    const loggedIn = await login(manicurist.email, manicurist.password);
    const current = await me(loggedIn.body.token);

    for (const res of [registered, loggedIn, current]) {
      expect(res.text).not.toContain('passwordHash');
      expect(res.text).not.toContain('tokenVersion');
      expect(res.text).not.toContain(manicurist.password);
    }
  });
});

describe('unknown routes', () => {
  it('return 404 NOT_FOUND in the standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
