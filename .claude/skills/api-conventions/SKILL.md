---
name: api-conventions
description: Conventions for nAIlbook's Express REST API, covering module layout, zod validation, the error shape and error codes, JWT auth, role and ownership checks, the endpoint list and Supertest tests. Use when adding or changing any endpoint, middleware, request schema or API test in server/.
---

# API conventions

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
| `DAY_HAS_BOOKINGS` | 409 | A manicurist tried to mark a day off that has active bookings. `details.bookings` lists them as `booking` objects (the shape below), by start time. |
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

## Middleware chains

A route lists the steps a request passes, in the order auth → role → `validateBody` → guards → costly work → handler (`backend-best-practices`). The handler only calls the service with `req.body` and what the steps put on `req`.

| Route | Chain |
|-------|-------|
| `POST /api/auth/register` | `validateBody(registerSchema)` → `requireFreeEmail` → `geocodeStudio` → handler `auth.register(req.body, req.coordinates)` |
| `PUT /api/me/profile` | `requireAuth` → `requireRole('MANICURIST')` → `validateBody(profileBody)` → `geocodeStudio` → handler `catalog.updateProfile(req.user.id, req.body, req.coordinates)` |

- `requireFreeEmail` (`src/middleware/require-free-email.ts`) answers `409 EMAIL_TAKEN` when the email exists. The service keeps its `P2002` catch, so two registrations at the same moment still get `409`.
- `geocodeStudio` (`src/middleware/geocode-studio.ts`) puts `{ latitude, longitude }` on `req.coordinates` (typed in `src/types/express.d.ts`). On registration it runs only for `role: 'MANICURIST'`. On the profile it loads the saved city and address of `req.user.id` and calls the geocoder only when either differs from the trimmed input; otherwise `req.coordinates` stays `undefined` and the saved coordinates are kept.

## Studio coordinates

- Every manicurist has `latitude` and `longitude` (numbers), found with `geocode(address, city)` from `src/lib/geocoder.ts`. `GEOCODER` picks the implementation: `nominatim` (the default) or `fake` (tests and the E2E server; no network).
- **Nominatim:** a structured GET to `https://nominatim.openstreetmap.org/search` with `street`, `city`, `country=България`, `format=jsonv2`, `limit=1` and the `User-Agent` from `NOMINATIM_USER_AGENT`. Requests run one at a time, at least 1000 ms apart. An in-memory cache keyed by city and address (trimmed, ignoring case) keeps found and not-found answers, never failures. A network error, a 5 s timeout or a non-2xx answer is `503 GEOCODER_UNAVAILABLE`. `createNominatimGeocoder({ fetch, userAgent })` builds one instance, for the unit tests.
- **The fake** returns the centre of a known city (София, Пловдив, Велико Търново, Варна, Бургас) and the centre of Bulgaria otherwise. An address containing «ненамерен» is not found and one containing «недостъпен» makes the geocoder unavailable, both ignoring case.
- Not found is `400 VALIDATION_ERROR` on `address`, unavailable is `503 GEOCODER_UNAVAILABLE`. In both cases nothing is created or changed: no user on registration, and neither the profile nor the user's name and phone on a profile save.

## Endpoints

| Method & path | Who | Purpose |
|---------------|-----|---------|
| `POST /api/auth/register` | guest | Create an account. Returns `201 { token, user }` |
| `POST /api/auth/login` | guest | Returns `{ token, user }` |
| `GET /api/auth/me` | logged in | Current user, as `{ user }` |
| `POST /api/auth/logout` | logged in | Revokes every token of the user. Returns `204` |
| `GET /api/manicurists?city=&service=` | anyone | Search |
| `GET /api/manicurists/:id` | anyone | Profile, services, working hours |
| `GET /api/manicurists/:id/days-off?from=&to=` | anyone | Dates to disable in the calendar |
| `GET /api/manicurists/:id/slots?serviceId=&date=` | anyone | Free slots for a day (`serviceId` optional) and its busy intervals |
| `PUT /api/me/profile` | manicurist | Update own profile |
| `POST /api/me/services`, `PUT/DELETE /api/me/services/:id` | manicurist | Manage own services |
| `PUT /api/me/working-hours` | manicurist | Replace weekly hours |
| `GET /api/me/days-off` | manicurist | Own upcoming days off |
| `POST /api/me/days-off` | manicurist | Mark a day off |
| `DELETE /api/me/days-off/:id` | manicurist | Reopen a date (soft delete: sets `deletedAt`) |
| `POST /api/bookings` | client | Book a slot |
| `GET /api/bookings/mine` | client | Own bookings, upcoming and past |
| `GET /api/bookings/schedule?date=` | manicurist | Own schedule for a day |
| `PATCH /api/bookings/:id/cancel` | client or manicurist of the booking | Cancel a booking |

Times in responses are UTC ISO strings. Dates are `YYYY-MM-DD`.

### Response shapes

This list is the contract the client codes against. Write the shape of a new endpoint here when it is agreed, before the client uses it, or at the latest in the change that builds it. If the code returns something else, fix the code or update this list in the same change.

| Endpoint | Success response |
|----------|------------------|
| `POST /api/auth/register` | `201 { token, user }`. `409 EMAIL_TAKEN` before the geocoder is called. For a manicurist: `400 VALIDATION_ERROR` on `address` when the address is not found, `503 GEOCODER_UNAVAILABLE` when it cannot be checked; neither creates a user. A client registration never calls the geocoder. |
| `POST /api/auth/login` | `200 { token, user }` |
| `GET /api/auth/me` | `200 { user }` |
| `POST /api/auth/logout` | `204`, no body |
| `GET /api/manicurists?city=&service=` | `200 { manicurists: [{ id, name, city, latitude, longitude, imageUrl, services: [{ id, name, durationMin, priceCents }] }] }`; `latitude` and `longitude` are the studio coordinates, as numbers. Both parameters are optional; an empty or blank one is no filter. Only manicurists with at least one active service are returned, so a new manicurist appears after adding the first service and disappears again when every service is removed. `city` matches part of the city and `service` part of an active service name, ignoring case, filtered in JS with `toLocaleLowerCase('bg')` and `includes` (SQLite ignores case only for ASCII). Manicurists and their services are sorted by name (`localeCompare` with `'bg'`). A repeated parameter is `400 VALIDATION_ERROR`. |
| `GET /api/manicurists/:id` | `200 { manicurist }`. `404 NOT_FOUND` for an unknown id or a user who is not a manicurist. |
| `GET /api/manicurists/:id/slots?serviceId=&date=` | `200 { date, dayOff, slots, busy }`. `slots` are UTC ISO start times: the 30-minute grid plus the exact ends of active bookings (see `scheduling-engine`). `busy` is the active `BOOKED` bookings on that Sofia date by `startAt`, as `[{ startAt, endAt }]` UTC ISO strings with exactly those two keys (no id, names or service); cancelled bookings are not in it. `date` is required (else `400 VALIDATION_ERROR`); `serviceId` is optional: without it `slots` is `[]`, and an unknown id or a user who is not a manicurist is `404 NOT_FOUND`. `404 NOT_FOUND` when the service is unknown, removed or does not belong to that manicurist. A day off is `200 { date, dayOff: true, slots: [], busy: [] }`; a date after the 12-month limit is `200 { date, dayOff: false, slots: [], busy: [] }`. |
| `PUT /api/me/profile`, body `{ name, phone, city, address, bio }` | `200 { manicurist }`. The fields follow the registration rules (`contactFields` and `profileFields` in `modules/auth/schemas.ts`): name, city and address trimmed and required, `phone` and `bio` trimmed and optional (default `""`). A body without `phone` saves `""`. Name and phone are saved in `User`, the rest in `ManicuristProfile`, in one transaction. When the city or the address changes, the geocoder runs before the transaction and the new coordinates are saved with it; `400 VALIDATION_ERROR` on `address` (not found) or `503 GEOCODER_UNAVAILABLE` leave the profile, the name and the phone unchanged. When neither changes, the geocoder is not called and the coordinates stay. |
| `POST /api/me/services`, body `{ name, description, durationMin, priceCents }` | `201 { service }` |
| `PUT /api/me/services/:id`, the same body (every field again) | `200 { service }`. `403 FORBIDDEN` for another manicurist's service, `404 NOT_FOUND` for a removed or unknown one. Bookings keep their own `serviceName` and `priceCents`. |
| `DELETE /api/me/services/:id` | `204`, no body. A soft delete (sets `deletedAt`), with the same `403` and `404` as `PUT`. |
| `PUT /api/me/working-hours`, body `{ workingHours: [{ weekday, startMin, endMin }] }` | `200 { workingHours }`, by weekday. Replaces the whole week in one transaction; an empty list means no working day. Existing bookings are not checked and stay, even outside the new hours. |
| `GET /api/manicurists/:id/days-off?from=&to=` | `200 { daysOff: ["YYYY-MM-DD", ...] }`: the active days off from `from` to `to` inclusive, ascending. `from` and `to` are required valid dates with `to >= from` and at most 366 days apart, else `400 VALIDATION_ERROR`. `404 NOT_FOUND` for an unknown id or a user who is not a manicurist. |
| `GET /api/me/days-off` | `200 { daysOff: [{ id, date }] }`: the own active days off from today (Sofia) on, ascending. |
| `POST /api/me/days-off`, body `{ date }` | `201 { dayOff: { id, date } }`. The checks of `canMarkDayOff`, in order: `400 SLOT_INVALID` for a past date or a date after the 12-month limit, `409 ALREADY_DAY_OFF`, `409 DAY_HAS_BOOKINGS` with `details: { bookings: booking[] }` (active `BOOKED` bookings on that Sofia date, by start time). A removed day off for the date is reused: its `deletedAt` is cleared and the same `id` comes back. The check and the write run in one transaction. |
| `DELETE /api/me/days-off/:id` | `204`, no body. A soft delete (sets `deletedAt`). `404 NOT_FOUND` for an unknown or already removed one, `403 FORBIDDEN` for another manicurist's. |
| `POST /api/bookings`, body `{ manicuristId, serviceId, startAt }` | `201 { booking }`. `400 SLOT_INVALID` when the start is after the 12-month limit. |
| `GET /api/bookings/mine` | `200 { upcoming, past }`, both `booking[]`. A booking is upcoming until it ends (`endAt >= now`), soonest first; past ones latest first. Cancelled bookings are included. |
| `GET /api/bookings/schedule?date=` | `200 { date, bookings }`: the manicurist's bookings on that Sofia date by start time, cancelled ones included |
| `PATCH /api/bookings/:id/cancel`, body `{ reason }` | `200 { booking }`. `reason` is required, trimmed, 1–200 characters. |

`user` is `{ id, email, name, phone, role }`. `phone` is `""` when the user gave none; the same holds for `phone` in `booking` and `manicurist`.

`booking` is `{ id, startAt, endAt, status, cancelledBy, cancelReason, serviceId, serviceName, priceCents, client: { id, name, phone }, manicurist: { id, name, phone, city, address } }`. `cancelledBy` and `cancelReason` are `null` while it is `BOOKED`. `serviceName` and `priceCents` are the snapshot from booking time; `serviceId` lets the client book the same service again. The nested users never carry an email.

`manicurist` is `{ id, name, email, phone, city, address, latitude, longitude, bio, imageUrl, services, workingHours }`: `latitude` and `longitude` are the studio coordinates (numbers), active services by name, `workingHours` as `{ weekday, startMin, endMin }` by weekday. `email` is the manicurist's login email, shown as a contact on the public page; `PUT /api/me/profile` does not change it. The search results and the bookings never carry an email. `imageUrl` is read-only for now.

`service` is `{ id, name, description, durationMin, priceCents }`.

Field rules for the manicurist's editors:

| Field | Rule |
|-------|------|
| `service.name` | trimmed, 1–80 characters |
| `service.description` | trimmed, up to 300 characters, optional; empty, blank, `null` or missing is saved as `null` |
| `service.durationMin` | whole minutes, a multiple of 5, from 15 to 480 |
| `service.priceCents` | whole cents, from 0 to 100000 (1000 €) |
| `workingHours[].weekday` | 0–6 (0 = Sunday), each at most once |
| `workingHours[].startMin`, `endMin` | multiples of 30, `0 <= startMin < endMin <= 1440` |

## Config

Settings are read from `server/.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `GEOCODER` (`nominatim`, the default, or `fake`) and `NOMINATIM_USER_AGENT` (default `nAIlbook (https://github.com/Anina1999/nAIlbook)`, sent to Nominatim as its usage policy asks). `src/lib/config.ts` throws when `JWT_SECRET` is missing or `GEOCODER` has another value, so the server does not start without them. Vitest and the E2E server set `GEOCODER=fake`. Keep `server/.env.example` in sync, and never commit `.env`.

## API tests

The test setup (database, helpers, dates) is in the `testing` skill.

- Use Supertest against the Express `app`. Export the app separately from `listen()` so tests can import it.
- Every test starts from an empty SQLite test database.
- For every new endpoint, test the happy path, `VALIDATION_ERROR`, a missing token (401) and a wrong owner (403). Also test each 409 the endpoint can return.
- For a chain with an outside call (`geocodeStudio`), test that each earlier step that rejects (zod, `EMAIL_TAKEN`, the role) stops the request before the call, with the spy described in `testing`.
