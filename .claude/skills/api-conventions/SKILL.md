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

- Validate every body, param and query with zod before any other work.
- Throw `new AppError(code, message, details?)`. One central error handler turns it into the response.
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

Add a new code here before you use it.

## Auth

- Passwords are hashed with bcrypt. Never return `passwordHash`.
- The JWT payload is `{ sub: userId, role }`. The client sends `Authorization: Bearer <token>`.
- `requireAuth` sets `req.user = { id, role }`. `requireRole('MANICURIST')` checks the role.
- **Ownership:** every write checks that the row belongs to `req.user.id`. Checking the role alone is not enough.
- Registering as a manicurist also creates an empty `ManicuristProfile`.

## Endpoints

| Method & path | Who | Purpose |
|---------------|-----|---------|
| `POST /api/auth/register` | guest | Create an account |
| `POST /api/auth/login` | guest | Returns `{ token, user }` |
| `GET /api/auth/me` | logged in | Current user |
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

## Config

Settings are read from `server/.env`: `DATABASE_URL`, `JWT_SECRET` and `PORT`. Keep `server/.env.example` in sync, and never commit `.env`.

## API tests

The test setup (database, helpers, dates) is in the `testing` skill.

- Use Supertest against the Express `app`. Export the app separately from `listen()` so tests can import it.
- Every test starts from an empty SQLite test database.
- For every new endpoint, test the happy path, `VALIDATION_ERROR`, a missing token (401) and a wrong owner (403). Also test each 409 the endpoint can return.
