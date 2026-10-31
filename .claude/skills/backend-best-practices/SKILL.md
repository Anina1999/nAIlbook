---
name: backend-best-practices
description: Node.js, Express and TypeScript practices for nAIlbook's server, with the reasons behind them, covering folders by kind of code, thin routes built from a middleware chain, validation at the edge, guards that run before costly work, Express 5 errors, services without HTTP, transactions, external services behind a seam (the geocoder), config and secrets, and ESM imports. Use when writing, reviewing or refactoring any code in server/src/. Works together with api-conventions (the exact endpoints, shapes and error codes), data-model and scheduling-engine.
---

# Best code practices (server)

These are the habits the server code follows and why. `api-conventions` has the exact endpoints, response shapes and error codes, `data-model` the schema and the seed, `scheduling-engine` the booking rules, `testing` the tests. If this skill and one of them disagree, the other skill wins: report the conflict.

## 1. Folders by kind of code

Each folder holds one kind of code, so a reader knows where to look and a change stays in one place:

- `modules/<module>/` is one area of the API: `routes.ts` (the router), `schemas.ts` (zod), `service.ts` (the logic and Prisma). Nothing outside the module imports its routes.
- `middleware/` holds the steps a request passes before its handler: auth, role, validation, guards, a lookup such as the geocoder.
- `lib/` holds shared code with no HTTP in it: `errors.ts`, `config.ts`, `prisma.ts`, `time.ts`, `jwt.ts`, `validate.ts`, and the client of every external service (`geocoder.ts`).
- `scheduling/` holds the booking rules as pure functions (`scheduling-engine`).
- `types/` holds the type augmentations (`express.d.ts`: what a middleware adds to `req`).

`app.ts` builds the app and `index.ts` starts it (CLAUDE.md), so Supertest imports the app without a port.

## 2. Thin routes, built from a middleware chain

A route reads as the list of steps the request passes, and its handler only calls the service and answers:

```ts
authRouter.post('/register', validateBody(registerSchema), requireFreeEmail, geocodeStudio, async (req, res) => {
  res.status(201).json(await auth.register(req.body, req.coordinates));
});
```

- **The order is always the same: auth → role → validation → guards → costly work → handler.** Each step runs only when every step before it passed, so a request that will fail anyway never reaches a database write or an external call.
- **A step that can reject goes into a middleware where it can.** Checking the token (`requireAuth`), the role (`requireRole`), the body (`validateBody`), a free email (`requireFreeEmail`) and the studio address (`geocodeStudio`) are middlewares. The reasons: the route shows its rules at a glance, every route reuses the same check, a test can see which step stopped a request, and the handler is left with the happy path.
- **Costly or outside work comes last in the chain.** A call to Nominatim waits up to a second (its rate limit) and counts against its usage policy, so it runs only after the user is authenticated, the form is valid and nothing else will reject it (`geocodeStudio` after `validateBody` and `requireFreeEmail`).
- **A middleware passes what it found on `req`, typed in `types/express.d.ts`** (`req.user`, `req.coordinates`), never through a global or `res.locals` without a type. `validateBody` replaces `req.body` with zod's output, so the handler gets trimmed, typed values.
- **A rule that needs the row being changed stays in the service**, inside its transaction: ownership (`checkOwnService`), the booking check and insert. A middleware cannot hold a transaction open for the handler.
- Params and query are parsed with `parse()` in the handler (Express 5 makes `req.query` read-only); the body goes through `validateBody`. Older routes still call `parse()` for the body in the handler; move them to the chain when you touch them, not in a separate sweep.

## 3. Errors with Express 5

- A middleware or handler just throws `new AppError(code, message, details?)` (or lets a rejected promise escape). Express 5 passes it to `errorHandler`, so there is no `try/catch` around a route and no `next(err)`.
- Every code is in the table in `api-conventions` first, then in `lib/errors.ts` with its status. The message is shown in the UI, so it is in Bulgarian.
- A field error has `details: [{ path, message }]`, the shape `parse()` gives, so the client puts it under its input. A check outside zod that belongs to a field (an address that is not found) uses the same shape.
- `try/catch` only where an error has a meaning to translate: Prisma's `P2002` on a unique email becomes `EMAIL_TAKEN`, an aborted fetch becomes `GEOCODER_UNAVAILABLE`.

## 4. Validation at the edge

- zod parses everything that comes from outside (body, params, query) before any other code reads it. The schemas live in the module's `schemas.ts` and export their input types (`RegisterInput`).
- The server is the source of truth: the client sends every field as a string and does not repeat the rules. `trim()` and `default('')` in the schema, not in the service.
- zod's Bulgarian messages are switched on once in `lib/validate.ts`.

## 5. Services: the logic, without HTTP

- A service function takes plain values (`userId`, the parsed input, `now`) and returns data in the contract's shape (`toManicurist`, `toBooking`). It never reads `req` or `res`, so tests and other services can call it directly.
- Prisma is called only from services and middleware lookups, through `lib/prisma.ts`. Each query selects the fields the shape needs (`manicuristSelect`), never the password hash or `tokenVersion`.
- **A check and the write it protects run in one transaction** (`prisma.$transaction`): the booking validation and insert, a day off and its bookings. A race test on the service proves it (`testing`).
- Time comes from `lib/time.ts` in Europe/Sofia, and `now` is a parameter, so a test can fix it.

## 6. External services behind a seam

An outside API (today Nominatim) lives in one file in `lib/`, and the rest of the app calls one function (`geocode(address, city)`):

- **The implementation is chosen by config** (`GEOCODER=nominatim|fake`). Vitest and the E2E server use the fake, so a test never calls the network: it is fast, it works offline and it respects the service's policy.
- **The real client respects the service:** its own `User-Agent`, its rate limit (a queue, 1 request per second for Nominatim), a cache for repeated questions, a timeout, and every failure (network, timeout, 429, any non-2xx) mapped to one error code (`GEOCODER_UNAVAILABLE`, 503).
- **Its factory takes its dependencies** (`createNominatimGeocoder({ fetch, userAgent })`), so a unit test passes a stub `fetch` and fake timers.
- The answer is saved where it is needed (the studio's coordinates in the profile), so the service is called on a change, not on every read.

## 7. Config and secrets

- Settings come from `server/.env` through `lib/config.ts`, which fails at startup when a secret is missing. Nothing else reads `process.env`.
- Every setting is in `server/.env.example` with a safe example; `.env` is never committed. Test values live in `vitest.config.ts` and in the E2E `webServer.env`.

## 8. Code style

- ESM: relative imports end in `.js` (`'./app.js'`), even from a `.ts` file.
- Names: files kebab-case or the module's role (`error-handler.ts`, `service.ts`), functions camelCase verbs (`searchManicurists`), middleware named by what it requires (`requireAuth`, `requireFreeEmail`) or does (`validateBody`, `geocodeStudio`).
- Comments say why, not what; a short comment above a non-obvious function says what it returns or throws.

## 9. Checklist before a change is done

- The route is a chain in the order of section 2; nothing costly runs before validation and the guards.
- Every rejection is an `AppError` with a code from `api-conventions`; no `try/catch` around a route.
- Services take plain values and never touch `req`/`res`; a check and its write share a transaction.
- No test calls the network; external services go through their seam and the fake.
- New settings are in `config.ts` and `.env.example`; imports end in `.js`.
- `npm test` and `npm run typecheck -w server` are green.
