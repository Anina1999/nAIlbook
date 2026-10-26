---
name: api-conventions
description: Conventions for nAIlbook's Express REST API, covering module layout, zod validation, the error shape and error codes, JWT auth, role and ownership checks, the endpoint list and Supertest tests. Use when adding or changing any endpoint, middleware, request schema or API test in server/.
---

# API conventions

## Module layout

```
server/src/modules/<module>/
  routes.ts    # Express router, thin: parse → call service → respond
  schemas.ts   # zod schemas for body, params, query
  service.ts   # business logic and Prisma calls
```

The modules are `auth`, `catalog` and `bookings`. Booking and slot rules live in `server/src/scheduling/` (see the `scheduling-engine` skill).

## Validation and errors

- Validate every body, param and query with zod before any other work. In the route call `parse(schema, req.body)` from `src/lib/validate.ts`, which returns the typed data or throws `VALIDATION_ERROR`. `details` is a list of `{ path, message }`, one per issue, so the client can show each message next to its input. zod's messages are in Bulgarian through `z.locales.bg()`. Give the fields a user fills in their own messages.
- Throw `new AppError(code, message, details?)` from `src/lib/errors.ts`, which maps each code to its HTTP status. One central error handler (`src/middleware/error-handler.ts`) turns it into the response. It also answers an unknown route with `404 NOT_FOUND`, a malformed JSON body with `400 VALIDATION_ERROR`, and any other error with `500 INTERNAL_ERROR` (logged on the server, never a stack trace in the response).
- Every error has exactly this shape: `{ "error": { "code": "...", "message": "...", "details": ... } }`
- Messages are in Bulgarian because the UI shows them. Codes are stable English constants.

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | zod rejected the input. `details` holds the zod issues. |
| `UNAUTHORIZED` | 401 | The token is missing or invalid. |
| `INVALID_CREDENTIALS` | 401 | Login failed. |
| `FORBIDDEN` | 403 | The role is wrong, or the user does not own the row. |
| `NOT_FOUND` | 404 | The resource does not exist. |
| `EMAIL_TAKEN` | 409 | The email is already registered. |
| `SLOT_INVALID` | 400 | The slot is off the grid, outside working hours or in the past. |
| `SLOT_TAKEN` | 409 | The slot overlaps an active booking. |
| `DAY_OFF` | 409 | Someone tried to book a day off. |
| `DAY_HAS_BOOKINGS` | 409 | A manicurist tried to mark a day off that has active bookings. `details.bookings` lists them. |
| `ALREADY_DAY_OFF` | 409 | The date is already a day off. |
| `NOT_CANCELLABLE` | 409 | The booking is in the past or already cancelled. |
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
- Registration accepts the role `CLIENT` or `MANICURIST`, never `ADMIN`. A manicurist also sends `city` and `address` (required) and `bio` (optional, default `""`), and the `ManicuristProfile` is created in the same nested create as the user.

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
| `GET /api/manicurists/:id/slots?serviceId=&date=` | anyone | Free slots for a day |
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
| `POST /api/auth/register` | `201 { token, user }` |
| `POST /api/auth/login` | `200 { token, user }` |
| `GET /api/auth/me` | `200 { user }` |
| `POST /api/auth/logout` | `204`, no body |
| `GET /api/manicurists?city=&service=` | `200 { manicurists: [{ id, name, city, imageUrl, services: [{ id, name, durationMin, priceCents }] }] }`. Both parameters are optional; an empty or blank one is no filter. `city` matches part of the city and `service` part of an active service name, ignoring case, filtered in JS with `toLocaleLowerCase('bg')` and `includes` (SQLite ignores case only for ASCII). Manicurists and their services are sorted by name (`localeCompare` with `'bg'`). A repeated parameter is `400 VALIDATION_ERROR`. |
| `GET /api/manicurists/:id` | `200 { manicurist }`. `404 NOT_FOUND` for an unknown id or a user who is not a manicurist. |
| `GET /api/manicurists/:id/slots?serviceId=&date=` | `200 { date, dayOff, slots }`. `slots` are UTC ISO start times. `404 NOT_FOUND` when the service is removed or does not belong to that manicurist. |
| `PUT /api/me/profile`, body `{ name, phone, city, address, bio }` | `200 { manicurist }`. The fields follow the registration rules (`contactFields` and `profileFields` in `modules/auth/schemas.ts`): name, phone, city and address trimmed and required, `bio` trimmed and optional (default `""`). Name and phone are saved in `User`, the rest in `ManicuristProfile`, in one transaction. |
| `POST /api/me/services`, body `{ name, description, durationMin, priceCents }` | `201 { service }` |
| `PUT /api/me/services/:id`, the same body (every field again) | `200 { service }`. `403 FORBIDDEN` for another manicurist's service, `404 NOT_FOUND` for a removed or unknown one. Bookings keep their own `serviceName` and `priceCents`. |
| `DELETE /api/me/services/:id` | `204`, no body. A soft delete (sets `deletedAt`), with the same `403` and `404` as `PUT`. |
| `PUT /api/me/working-hours`, body `{ workingHours: [{ weekday, startMin, endMin }] }` | `200 { workingHours }`, by weekday. Replaces the whole week in one transaction; an empty list means no working day. Existing bookings are not checked and stay, even outside the new hours. |
| `POST /api/bookings`, body `{ manicuristId, serviceId, startAt }` | `201 { booking }` |
| `GET /api/bookings/mine` | `200 { upcoming, past }`, both `booking[]`. A booking is upcoming until it ends (`endAt >= now`), soonest first; past ones latest first. Cancelled bookings are included. |
| `GET /api/bookings/schedule?date=` | `200 { date, bookings }`: the manicurist's bookings on that Sofia date by start time, cancelled ones included |
| `PATCH /api/bookings/:id/cancel`, body `{ reason }` | `200 { booking }`. `reason` is required, trimmed, 1–200 characters. |

`user` is `{ id, email, name, phone, role }`.

`booking` is `{ id, startAt, endAt, status, cancelledBy, cancelReason, serviceId, serviceName, priceCents, client: { id, name, phone }, manicurist: { id, name, phone, city, address } }`. `cancelledBy` and `cancelReason` are `null` while it is `BOOKED`. `serviceName` and `priceCents` are the snapshot from booking time; `serviceId` lets the client book the same service again. The nested users never carry an email.

`manicurist` is `{ id, name, phone, city, address, bio, imageUrl, services, workingHours }`: active services by name, `workingHours` as `{ weekday, startMin, endMin }` by weekday. No email. `imageUrl` is read-only for now.

`service` is `{ id, name, description, durationMin, priceCents }`.

Field rules for the manicurist's editors:

| Field | Rule |
|-------|------|
| `service.name` | trimmed, 1–80 characters |
| `service.description` | trimmed, up to 300 characters, optional; empty, blank, `null` or missing is saved as `null` |
| `service.durationMin` | whole minutes, a multiple of 15, from 15 to 480 |
| `service.priceCents` | whole cents, from 0 to 100000 (1000 €) |
| `workingHours[].weekday` | 0–6 (0 = Sunday), each at most once |
| `workingHours[].startMin`, `endMin` | multiples of 30, `0 <= startMin < endMin <= 1440` |

## Config

Settings are read from `server/.env`: `DATABASE_URL`, `JWT_SECRET` and `PORT`. `src/lib/config.ts` throws when `JWT_SECRET` is missing, so the server does not start without it. Keep `server/.env.example` in sync, and never commit `.env`.

## API tests

The test setup (database, helpers, dates) is in the `testing` skill.

- Use Supertest against the Express `app`. Export the app separately from `listen()` so tests can import it.
- Every test starts from an empty SQLite test database.
- For every new endpoint, test the happy path, `VALIDATION_ERROR`, a missing token (401) and a wrong owner (403). Also test each 409 the endpoint can return.
