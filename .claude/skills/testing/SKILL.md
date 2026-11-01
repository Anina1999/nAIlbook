---
name: testing
description: Test setup for nAIlbook, covering the server/tests/ layout, the Vitest config, the SQLite test database, shared helpers and factories, dates in tests, the Playwright E2E tests in client/e2e/ and the Postman collection. Use when creating or changing any test file, test helper, Vitest or Playwright config, when a test fails for setup reasons, or when editing docs/postman/.
---

# Testing

This skill covers how tests are set up and run. What each module must test is listed in its own skill: `api-conventions` (API tests) and `scheduling-engine` (unit and API tests for the engine).

## Rules

- Tests are written with each module, not at the end. A module is done only when `npm test` passes.
- Never weaken an assertion, delete a test or add `.skip` to make the suite green. Fix the code, or stop and ask if the test is wrong.
- Never commit `.only` or `.skip`.
- Assert on the HTTP status and `error.code`. Do not assert on Bulgarian message text, because wording changes.
- Server tests never depend on the seed. Each test creates the data it needs with the factories. E2E tests are the exception: they start from the seed (see E2E).
- Run `npm test` and `npm run e2e` from one process at a time. Each shares one database file (`test.db`, `e2e.db`), and E2E also its ports, so two runs at once give false failures.

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
    unit/                   # pure functions, no database: scheduling/, lib/time.ts, lib/geocoder.ts
    api/                    # Supertest, one file per area: auth, catalog, days-off, bookings,
                            # coordinates (the geocoder in registration and profile save)
```

Name files `<area>.test.ts`. Use one `describe` per endpoint (`describe('POST /api/bookings')`) or per function, and write each `it` as a behaviour (`it('returns 409 SLOT_TAKEN when the slot overlaps')`).

## Vitest config

- `test.env` sets `DATABASE_URL="file:./test.db"`, a fixed `JWT_SECRET="test-secret"` and `GEOCODER="fake"`. These are test-only values, not secrets. `test.db` is ignored by the `*.db` rule in `.gitignore`.
- `globalSetup` deletes any old `test.db` and runs `prisma migrate deploy` against it. The test database always matches the migrations.
- `fileParallelism: false`, because all API test files share one SQLite file.

## Database

- Each API test file calls `resetDb()` in `beforeEach`. It deletes all rows in child-to-parent order: `Booking`, `DayOff`, `WorkingHours`, `Service`, `ManicuristProfile`, `User`. Every test then starts from an empty database.
- When a model is added to the schema, add it to `resetDb()` in the same change.
- Unit tests in `tests/unit/` never import Prisma or `db.ts`.

## Helpers

- **Factories** take an optional overrides object and return the created row. `createManicurist()` also creates the profile, working hours Monday to Friday 09:00–18:00 and one 60-minute service, so a booking test needs one call. The profile gets the studio coordinates `DEFAULT_COORDINATES` (exported, the centre of Sofia: 42.6977, 23.3219) unless `latitude` and `longitude` are passed. A test that creates a profile without the factory passes both too, because they are required.
- `createBooking(client, manicurist, overrides)` inserts a booking of the manicurist's first service directly, without validation, so a test can set up past, started and cancelled bookings. The default start is next Monday at 10:00. `createDayOff(manicurist, date, { deletedAt? })` creates an active or a removed day off. `createService(manicurist, overrides)` adds one more service (default "Гел лак", 90 minutes, 4000 cents), or a removed one when `deletedAt` is passed.
- **Auth:** `tokenFor(user)` and `authHeader(user)` sign a JWT through the app's own `signToken`, so the payload is always the app's `{ sub, role, tokenVersion }`. Pass a user row straight from a factory. Only the auth tests go through `/register` and `/login`. Every other test uses `tokenFor`. The one exception is a flow test that has to start with a real registration, such as the catalog test where a newly registered manicurist appears in search only after adding the first service (approved 2026-10-29); it uses the token that `/register` returns.
- Passwords in factories are hashed with a low bcrypt cost (4) to keep tests fast. Every factory user has the password `TEST_PASSWORD`.
- **Races** are tested on the service, not through HTTP. Supertest requests reach the database one after another, so an HTTP race test passes even without the transaction. `tests/api/bookings-race.test.ts` calls `createBooking` several times at once and expects one booking and `SLOT_TAKEN` for the rest; it fails when the transaction is removed. `tests/api/days-off-race.test.ts` does the same for `markDayOff` against `createBooking` (a booking or the day off, never both) and for `markDayOff` against itself (one `ALREADY_DAY_OFF` for each loser, one reused row for a removed date).
- Code that needs a role check but has no real endpoint yet is tested on a small Express app built inside the test file, never on a fake route added to `app`.

## The geocoder in tests

- **No test calls the network.** `GEOCODER=fake` in `vitest.config.ts` (and in the E2E `webServer.env`) makes `geocode()` the fake: the centre of a known city (София, Пловдив, Велико Търново, Варна, Бургас), else the centre of Bulgaria. Two words in the address simulate the failures, ignoring case: «ненамерен» → not found (`400 VALIDATION_ERROR` on `address`), «недостъпен» → `503 GEOCODER_UNAVAILABLE`.
- **Expected coordinates** come from the fake itself through `vi.importActual` (`fakeCoordinates()` in `tests/api/coordinates.test.ts`), not from numbers copied into the test.
- **The spy.** A test that checks whether the geocoder was called wraps the real module, so the fake still answers:

  ```ts
  vi.mock('../../src/lib/geocoder.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/geocoder.js')>();
    return { ...actual, geocode: vi.fn(actual.geocode) };
  });
  const geocodeSpy = vi.mocked(geocode); // mockClear() in beforeEach
  ```

  `vi.mock` applies to the whole file, so these tests live in their own file, `tests/api/coordinates.test.ts`, and `auth.test.ts` and `catalog.test.ts` run the plain fake. Like the auth tests, it registers through `/register`.
- **The Nominatim client** is unit-tested in `tests/unit/geocoder.test.ts` through `createNominatimGeocoder({ fetch, userAgent })`, with a `vi.fn` stub for `fetch` returning real `Response` objects, and `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })` for the 1000 ms spacing and the 5 s timeout. The client must use only those timers (not `AbortSignal.timeout` or `performance.now`), and the timeout stub rejects when `init.signal` aborts. Each test builds its own instance, so the queue and the cache start empty.

## Dates and time

- **Unit tests** pass a fixed `now` and fixed dates. They never read the real clock.
- **API tests** use the real clock, because the endpoints read it. Never hardcode a calendar date in an API test. Use `dates.ts` helpers such as `nextWeekday(1)` (the next Monday at least 2 days ahead, as a Sofia `YYYY-MM-DD`) and `slotAt(date, '10:00')` (a UTC ISO string), and `daysAgo(7)` for a past date. They go through `server/src/lib/time.ts`. `daysAhead(n)` is the Sofia date n days from today. `horizonEnd()` is the last date that can be booked or marked as a day off (today plus 12 months), written out in the helper on purpose, so API tests do not depend on `addMonths` or `lastBookableDate` in `src/`. `nextWeekdayBeyondHorizon(weekday)` is the first date with that weekday that is certainly beyond the limit.
- Do not use fake timers in API tests.
- `lib/time.ts` has unit tests for both daylight-saving switch days (the last Sunday of March and of October).

## Commands

```
npm test                             # all tests, from the root or server/
npx vitest run tests/unit            # in server/, unit tests only
npx vitest run tests/api/bookings    # in server/, one file
npm run e2e                          # Playwright, from the root or client/
npx playwright test e2e/smoke        # in client/, one file
```

## E2E (Playwright)

- The tests live in `client/e2e/`, named `<screen or flow>.spec.ts`, with `client/playwright.config.ts` next to `src/`. They are typechecked by `client/e2e/tsconfig.json` as part of `npm run typecheck -w client`.
- **Their own servers and database.** Playwright starts the server on port 3100 and the client on 5180 (`client/e2e/ports.ts`), with `reuseExistingServer: false`, so a running dev server (3000, 5173, `dev.db`) is never used. The server gets every setting from `webServer.env` (`DATABASE_URL="file:./e2e.db"`, a test-only `JWT_SECRET`, `PORT`, `CLIENT_ORIGIN`), with no `.env` and no watch. Its command `npm run e2e:server` (in `server/`) runs `scripts/e2e-db.ts` first: it deletes `e2e.db`, runs `prisma migrate deploy` and `prisma db seed`, and refuses any `DATABASE_URL` other than `e2e.db`, because the seed deletes every row. `e2e.db` is ignored by the `*.db` rule.
- **Two projects:** `chromium` (desktop) and `mobile` (Chromium at 375×812). Every test runs in both. `workers: 1`, because the tests share one database.
- **Local map tiles.** No test calls the OpenStreetMap tile server (its policy forbids automated use, and CI must not depend on the network). `client/e2e/fixtures.ts` extends Playwright's `test` so that every `page` routes `https://tile.openstreetmap.org/**` to a 1×1 PNG built from base64 in the code (the map's ground colour; no binary file in the repo). **Every spec file imports `test` and `expect` from `./fixtures`**, never from `@playwright/test`. Other outside requests (Google Fonts) are not part of this rule.
- **Dates in E2E** ("today", a Monday, the seeded day off) are computed in the test with its own `Intl` helpers in `Europe/Sofia`, never with the machine's local date and never with the client's `utils/dates.ts`, so a bug there cannot hide behind the same bug in the test.
- **The seed is the starting state.** Use the demo accounts from the README to log in. A test that creates rows uses a unique email (for example with `Date.now()`), so a second run in a row passes too. Never depend on rows another test created. **A manicurist a test creates with a service gets a unique name as well** (with `testInfo.project.name` and `Date.now()`, like the email): it shows on `/` for every later test, in both projects, and `home.spec.ts` finds the cards and markers by name, so a fixed name gives two cards with one name on the second project (PR #30).
- **Selectors** follow Playwright's own order of preference: what a user sees first, a test id only as a fallback.
  - **First `getByRole`** with the Bulgarian accessible name (`getByRole('button', { name: 'Запази час' })`), then `getByLabel` for form fields and `getByText` for plain text. Such a test also checks accessibility: it fails when a control is not a real `<button>` or link, or has no label or `aria-label`, which is exactly what a screen reader user would miss. A calendar day, for example, needs an `aria-label` with the full date, so the test finds it by name and a screen reader reads more than «3».
  - **The UI text is part of the contract.** The wording is set in `ui-design` (*Writing UI text*), so a test may assert it. The cost: a wording change also changes the test (when «Няма маникюристи…» became «Не са открити маникюристи…», `search.spec.ts` changed with it). That is intended: the test checks what the user reads.
  - **`data-testid` and `getByTestId` only where there is no stable accessible name**, such as a chart. Never on an element a user can name (a button, a link, a field, a heading, a map marker), and never just to make a selector shorter. Each test id gets a short comment in the code saying why the element has no accessible name. Test ids are kebab-case and name the role: `data-testid="donut-chart"`.
  - **Map markers have names, so they are found by role** inside their section: `getByRole('region', { name: 'Студиа на картата' }).getByRole('button', { name: 'Мария Петрова на картата' })`, and the active one checked with `toHaveAttribute('aria-pressed', 'true')`. On `/manicurists/:id` the one marker is `getByRole('img', { name: '<име> на картата' })`. Choose a marker with `focus()` and `Enter`, not a mouse click: two studios in one city overlap at the zoom that shows the whole country, so a click can land on the other one.
  - **Controls whose state comes from the URL** (a radio or a toggle bound to search params, such as the service on `/manicurists/:id`): `click()` it, then `expect(...).toBeChecked()` or `toHaveAttribute('aria-pressed', 'true')`, which retries. Not `locator.check()`: the state turns on only after the router re-renders, so `check()` sees the old state and fails.
  - **Required fields:** a required field's label ends in a ` *` hidden from screen readers (`ui-design`, the Input row): find that field by role and accessible name, `getByRole('textbox', { name: 'Име', exact: true })`, because `getByLabel(..., { exact: true })` matches the label text with the ` *`. `getByLabel` without `exact` still works when the label is unique as a substring.
- Each screen of module 4 comes with 1–3 E2E tests for its main flow and its 375px layout. Rules already covered by unit or API tests (slot calculation, booking validation, error codes) are not repeated in E2E.
- **No horizontal scroll at 375px takes two checks.** The layout clips sideways overflow (`overflow-x: clip` on `.app`), so `documentElement.scrollWidth − clientWidth` stays 0 even when content runs off the screen: with a manicurist's second header link the menu ran 75.7px past the window and that check still passed. Keep it, and also check that the right edge (`getBoundingClientRect().right`) of every element in `header` and `main` stays within `clientWidth`. Both checks live in `client/e2e/layout.ts`: every spec imports `horizontalOverflow` and `contentOverflow` from `./layout` and asserts both are 0 at each 375px check, never a copy of its own. Elements a widget places off-screen on purpose, inside a box that clips them, are left out of the second check in that one helper: Swiper's `.swiper-wrapper` (the carousel's slides out of view) and Leaflet's `.leaflet-pane`s (tiles and markers in map coordinates), each with everything in it. The carousel, the map box and their controls are still checked. A new widget of that kind adds its own exclusion there, with a comment. The check measures the layout at rest: `getBoundingClientRect` includes `scale`, so a control that grows on hover past the edge on purpose (the carousel's «Следващи» at 375px, `ui-design`) is measured after `page.mouse.move(0, 0)` with `expect.poll`, which waits for the shrink.
- **A server that does not answer** (the server-down page, `ui-conventions`, *No connection*) is simulated for the page only: `page.route(\`${API_URL}/**\`, (route) => route.abort('connectionrefused'))`, with `API_URL` from `client/e2e/ports.ts`. Never stop the `webServer`: the next tests need it. The `request` fixture is not routed, so the test sets up its data (register, book) through it before the route; a logged-in user gets the token with `page.addInitScript` setting `nailbook.token`. Before the step that expects the server back, `page.unroute` with the same pattern. After a failed `/me`, check that the token is still in `localStorage`, which proves the failure did not log the user out (`client/e2e/not-found.spec.ts`).
- In CI the separate `E2E` job runs after `CI`, installs Chromium with `npx playwright install --with-deps chromium` and uploads `client/playwright-report/` when it fails.

## Postman collection

- The collection lives in `docs/postman/nAIlbook.postman_collection.json`, with one folder per module: Auth, Catalog, Days off and Bookings.
- This JSON file (Collection v2.1) is the source of truth, because every Postman version can import it. Newer Postman versions also sync a linked folder as their own YAML files. `.gitignore` keeps them out of the repo, so a change made in Postman is lost unless it is exported back over the JSON file. After the JSON changes, import it again in Postman and replace the old collection.
- It runs against the seeded dev server. A `baseUrl` variable defaults to `http://localhost:3000`.
- The login requests save the token in a collection variable with a test script. Never save a real token or password other than the seed demo accounts in the exported file.
- Every request has at least one test that checks the status code. Error cases (400, 401, 403, 409) have their own requests.
- When an endpoint is added or changed, update its request in the same change.

## Out of scope

The MVP has no client unit tests: the client is covered by the E2E tests and a look by hand on desktop and at phone width. WebKit, Firefox, visual regression and Playwright MCP are not set up yet.
