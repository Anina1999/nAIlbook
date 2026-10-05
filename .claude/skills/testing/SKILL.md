---
name: testing
description: Test setup for nAIlbook, covering the server/tests/ layout, the Vitest config, the SQLite test database, shared helpers and factories, dates in tests and the Postman collection. Use when creating or changing any test file, test helper or Vitest config, when a test fails for setup reasons, or when editing docs/postman/.
---

# Testing

This skill covers how tests are set up and run. What each module must test is listed in its own skill: `api-conventions` (API tests) and `scheduling-engine` (unit and API tests for the engine).

## Rules

- Tests are written with each module, not at the end. A module is done only when `npm test` passes.
- Never weaken an assertion, delete a test or add `.skip` to make the suite green. Fix the code, or stop and ask if the test is wrong.
- Never commit `.only` or `.skip`.
- Assert on the HTTP status and `error.code`. Do not assert on Bulgarian message text, because wording changes.
- Tests never depend on the seed. Each test creates the data it needs with the factories.

## Layout

```
server/
  vitest.config.ts
  tests/
    setup/global-setup.ts   # creates the test database once per run
    helpers/
      db.ts                 # prisma client for tests, resetDb()
      factories.ts          # createClient, createManicurist, createService, createBooking...
      auth.ts               # tokenFor(user), authHeader(user)
      dates.ts              # future Sofia dates and slot times
    unit/                   # pure functions, no database: scheduling/, lib/time.ts
    api/                    # Supertest, one file per area: auth, catalog, days-off, bookings
```

Name files `<area>.test.ts`. Use one `describe` per endpoint (`describe('POST /api/bookings')`) or per function, and write each `it` as a behaviour (`it('returns 409 SLOT_TAKEN when the slot overlaps')`).

## Vitest config

- `test.env` sets `DATABASE_URL="file:./test.db"` and a fixed `JWT_SECRET="test-secret"`. These are test-only values, not secrets. `test.db` is ignored by the `*.db` rule in `.gitignore`.
- `globalSetup` deletes any old `test.db` and runs `prisma migrate deploy` against it. The test database always matches the migrations.
- `fileParallelism: false`, because all API test files share one SQLite file.

## Database

- Each API test file calls `resetDb()` in `beforeEach`. It deletes all rows in child-to-parent order: `Booking`, `DayOff`, `WorkingHours`, `Service`, `ManicuristProfile`, `User`. Every test then starts from an empty database.
- When a model is added to the schema, add it to `resetDb()` in the same change.
- Unit tests in `tests/unit/` never import Prisma or `db.ts`.

## Helpers

- **Factories** take an optional overrides object and return the created row. `createManicurist()` also creates the profile, working hours Monday to Friday 09:00–18:00 and one 60-minute service, so a booking test needs one call.
- **Auth:** `tokenFor(user)` signs a JWT with the same payload as the app, `{ sub, role }`. Only the auth tests go through `/register` and `/login`. Every other test uses `tokenFor`.
- Passwords in factories are hashed with a low bcrypt cost (for example 4) to keep tests fast.

## Dates and time

- **Unit tests** pass a fixed `now` and fixed dates. They never read the real clock.
- **API tests** use the real clock, because the endpoints read it. Never hardcode a calendar date in an API test. Use `dates.ts` helpers such as `nextWeekday(1)` (the next Monday at least 2 days ahead, as a Sofia `YYYY-MM-DD`) and `slotAt(date, '10:00')` (a UTC ISO string). Both go through `server/src/lib/time.ts`.
- Do not use fake timers in API tests.
- `lib/time.ts` has unit tests for both daylight-saving switch days (the last Sunday of March and of October).

## Commands

```
npm test                             # all tests, from the root or server/
npx vitest run tests/unit            # in server/, unit tests only
npx vitest run tests/api/bookings    # in server/, one file
```

## Postman collection

- The collection lives in `docs/postman/nAIlbook.postman_collection.json`, with one folder per module: Auth, Catalog, Days off and Bookings.
- It runs against the seeded dev server. A `baseUrl` variable defaults to `http://localhost:3000`.
- The login requests save the token in a collection variable with a test script. Never save a real token or password other than the seed demo accounts in the exported file.
- Every request has at least one test that checks the status code. Error cases (400, 401, 403, 409) have their own requests.
- When an endpoint is added or changed, update its request in the same change.

## Out of scope

The MVP has no client unit tests and no Playwright. The UI is checked by hand on desktop and at phone width.
