---
name: api-conventions
description: Conventions for nAIlbook's Express REST API, covering module layout, zod validation, the error shape and error codes, JWT auth, role and ownership checks, the endpoint list and Supertest tests. Use when adding or changing any endpoint, middleware, request schema or API test in server/.
---

# API conventions

## Reference files

The rules in this file hold for every task. Read a reference file only when the task needs it:

| File | Read it when |
|------|--------------|
| [references/endpoints.md](references/endpoints.md): *Endpoints*, *Response shapes* (with `user`, `booking`, `manicurist`, `service` and the editors' field rules) | adding, changing, calling or testing an endpoint |
| [references/geocoding.md](references/geocoding.md): *Middleware chains*, *Studio coordinates* | touching registration, `PUT /api/me/profile`, `geocodeStudio`, `requireFreeEmail` or the geocoder |

## Module layout

```
server/src/modules/<module>/
  routes.ts    # Express router, thin: a middleware chain (auth → role → validateBody → guards → costly work) → call service → respond; see backend-best-practices
  schemas.ts   # zod schemas for body, params, query
  service.ts   # business logic and Prisma calls
```

The modules are `auth`, `catalog` and `bookings`. Booking and slot rules live in `server/src/scheduling/` (see the `scheduling-engine` skill).

## Validation and errors

- Validate every body, param and query with zod before any other work. `parse(schema, data)` from `src/lib/validate.ts` returns the typed data or throws `VALIDATION_ERROR`. A body goes through the middleware `validateBody(schema)` (`src/middleware/validate.ts`), which calls `parse()` and replaces `req.body` with zod's output; params and query are parsed with `parse()` in the handler. Routes that still parse the body in the handler move to `validateBody` when they are next changed (see `backend-best-practices`). `details` is a list of `{ path, message }`, one per issue, so the client can show each message next to its input. zod's messages are in Bulgarian through `z.locales.bg()`. Give the fields a user fills in their own messages.
- Throw `new AppError(code, message, details?)` from `src/lib/errors.ts`, which maps each code to its HTTP status. One central error handler (`src/middleware/error-handler.ts`) turns it into the response. It also answers an unknown route with `404 NOT_FOUND`, a malformed JSON body with `400 VALIDATION_ERROR`, and any other error with `500 INTERNAL_ERROR` (logged on the server, never a stack trace in the response).
- Every error has exactly this shape: `{ "error": { "code": "...", "message": "...", "details": ... } }`
- Messages are in Bulgarian because the UI shows them. Codes are stable English constants.

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | zod rejected the input. `details` holds the zod issues. Also a studio address the geocoder did not find: `details` is one issue on the path `address`, message «Не намерихме този адрес в града. Проверете улицата и номера.» |
| `UNAUTHORIZED` | 401 | The token is missing or invalid. |
| `INVALID_CREDENTIALS` | 401 | Login failed. |
| `FORBIDDEN` | 403 | The role is wrong, or the user does not own the row. |
| `NOT_FOUND` | 404 | The resource does not exist. |
| `EMAIL_TAKEN` | 409 | The email is already registered. |
| `SLOT_INVALID` | 400 | The slot is outside working hours, neither on the grid nor exactly the end of an active booking, in the past or too far ahead (after the 12-month limit). A day off on a past date or after the limit gets it too. |
| `SLOT_TAKEN` | 409 | The slot overlaps an active booking. |
| `DAY_OFF` | 409 | Someone tried to book a day off. |
| `DAY_HAS_BOOKINGS` | 409 | A manicurist tried to mark a day off that has active bookings. `details.bookings` lists them as `booking` objects (the shape in *Response shapes*), by start time. |
| `ALREADY_DAY_OFF` | 409 | The date is already a day off. |
| `NOT_CANCELLABLE` | 409 | The booking is in the past or already cancelled. |
| `GEOCODER_UNAVAILABLE` | 503 | The geocoder could not check the studio address: a network error, no answer within 5 s, or any non-2xx answer (429 included). Nothing is saved. Message «Не успяхме да проверим адреса. Опитайте отново след малко.» |
| `INTERNAL_ERROR` | 500 | An unexpected error. The details stay in the server log. |

Add a new code here before you use it.

## Auth

- Passwords are hashed with bcrypt (cost 10). They are 8–72 characters, because bcrypt ignores everything after 72 bytes. Emails are trimmed and lowercased before they are saved or compared.
- A user in a response has only `id, email, name, phone, role`. Never return `passwordHash` or `tokenVersion`.
- Login answers an unknown email and a wrong password with the same `401 INVALID_CREDENTIALS`, and runs `bcrypt.compare` in both cases, so the response time does not reveal which emails exist.
- The JWT payload is `{ sub: userId, role, tokenVersion }`, signed with HS256 (the only algorithm `verify` accepts) and valid for 1 day. `src/lib/jwt.ts` signs and verifies it. The client sends `Authorization: Bearer <token>`.
- **Revocation:** `requireAuth` loads the user and rejects the token with `401 UNAUTHORIZED` when the user no longer exists or `tokenVersion` differs from the database. `POST /api/auth/logout` increments `tokenVersion`, so every token of that user stops working at once, on all devices.
- `requireAuth` sets `req.user = { id, role }`, with the role from the database. `requireRole('MANICURIST')` checks the role and goes after `requireAuth`.
- **Ownership:** every write checks that the row belongs to `req.user.id`. Checking the role alone is not enough. The service checks it after validation: a missing or soft-deleted row is `404 NOT_FOUND`, someone else's row is `403 FORBIDDEN`. `/api/me/*` routes act on the logged-in manicurist's own data and never take a manicurist id.
- Registration accepts the role `CLIENT` or `MANICURIST`, never `ADMIN`. Every role sends `name` (required) and may send `phone` (optional, trimmed, default `""`, like `bio`; `User.phone` stays a non-null `String`, so a missing phone is stored as `""`, never `null`). A manicurist also sends `city` and `address` (required) and `bio` (optional, default `""`), and the `ManicuristProfile` is created in the same nested create as the user, with the studio coordinates the geocoder found (see *Studio coordinates*).

## Config

Settings are read from `server/.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `GEOCODER` (`nominatim`, the default, or `fake`) and `NOMINATIM_USER_AGENT` (default `nAIlbook (https://github.com/Anina1999/nAIlbook)`, sent to Nominatim as its usage policy asks). `src/lib/config.ts` throws when `JWT_SECRET` is missing or `GEOCODER` has another value, so the server does not start without them. Vitest and the E2E server set `GEOCODER=fake`. Keep `server/.env.example` in sync, and never commit `.env`.

## API tests

The test setup (database, helpers, dates) is in the `testing` skill.

- Use Supertest against the Express `app`. Export the app separately from `listen()` so tests can import it.
- Every test starts from an empty SQLite test database.
- For every new endpoint, test the happy path, `VALIDATION_ERROR`, a missing token (401) and a wrong owner (403). Also test each 409 the endpoint can return.
- For a chain with an outside call (`geocodeStudio`), test that each earlier step that rejects (zod, `EMAIL_TAKEN`, the role) stops the request before the call, with the spy described in `testing`.
