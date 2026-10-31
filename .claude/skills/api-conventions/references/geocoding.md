# api-conventions: middleware chains and studio coordinates

Part of the `api-conventions` skill ([SKILL.md](../SKILL.md)).

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
