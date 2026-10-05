# Architecture

nAIlbook is a manicure booking platform. Clients search manicurists by city and service, see the real free slots and book. Manicurists manage their services, weekly working hours and days off.

```
client/ (React)  ──REST/JSON──►  server/ (Express)
                                    │
                 ┌──────────────────┼──────────────────────┐
           modules/auth      modules/catalog        modules/bookings
                 │                  │                      │
                 │                  │               scheduling/ (pure)
                 └──────────────────┴──────────────────────┘
                                    │
                             Prisma + SQLite
```

Dependencies point one way. Routes call services, and services call Prisma and the pure `scheduling/` functions. `scheduling/` imports nothing from the app, so it can be unit-tested without a database or HTTP.

The detailed rules live in project skills under [.claude/skills/](../.claude/skills/):

| Skill | Covers |
|-------|--------|
| `scheduling-engine` | Slot calculation, booking validation, days off, cancel rules, time model |
| `api-conventions` | Module layout, zod, error shape and codes, auth and ownership, endpoint list, API tests |
| `data-model` | Prisma models, field conventions, seed |
| `ui-conventions` | Client structure, screens, date and slot picker rules, Bulgarian UI |
| `testing` | Test layout, Vitest config, test database, helpers, dates in tests, Postman collection |

---

## Modules

### 1. Auth & Users

- **Owns:** `server/src/modules/auth/` and `server/src/middleware/auth.ts`.
- **Exposes:**
  - endpoints for register, login and the current user (`/me`);
  - `requireAuth`, which sets `req.user`;
  - `requireRole(...)`.
- **Done when:** API tests cover register, a duplicate email, login, a wrong password, `/me` with and without a token, and a role guard rejection.

### 2. Data & Catalog

- **Owns:** `server/prisma/` (schema, migrations, seed) and `server/src/modules/catalog/`.
- **Exposes:**
  - search and the public manicurist page;
  - a public list of days off;
  - endpoints where a manicurist manages their own profile, services, working hours and days off.
- **Done when:** the seed gives a working demo, and API tests cover ownership (403), validation (400) and the day-off conflict (409).

### 3. Scheduling & Booking engine ⭐

- **Owns:**
  - `server/src/scheduling/` (pure functions);
  - `server/src/lib/time.ts`;
  - `server/src/modules/bookings/`.
- **Exposes:**
  - the functions `calculateAvailableSlots`, `validateBooking`, `canMarkDayOff` and `canCancel`;
  - the slots, booking, my-bookings, schedule and cancel endpoints.
- **Done when:** unit tests cover every slot and validation rule, and API tests cover booking, a taken slot, booking a day off and a cancel by a non-owner.

### 4. Frontend UI

- **Owns:** `client/`.
- **Exposes:**
  - for everyone: search and the manicurist page with a slot picker;
  - for guests: login and registration;
  - for clients: my bookings;
  - for manicurists: my schedule, days off, and editors for the profile, services and hours.
- **Done when:** every flow works by hand on desktop and at phone width.

### 5. Testing layer

- **Owns:** `server/tests/`, the Postman collection in `docs/postman/` and optional Playwright tests in `client/e2e/`.
- **Rule:** tests are written with each module, not at the end.

---

## Build order

Each step depends on the ones before it: bookings need the schema and `requireAuth`, and the UI needs the API. The scheduling engine comes before catalog CRUD because it carries the most risk.

1. Scaffold the project, write the Prisma schema and seed (module 2, data part).
2. Module 1, Auth.
3. Module 3, Scheduling engine and bookings. This is the critical path.
4. Module 2, Catalog CRUD and days off, plus the Postman collection.
5. Module 4, UI.
6. Wrap-up: end-to-end manual test, README, optional Playwright.
