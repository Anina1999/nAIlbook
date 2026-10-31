# api-conventions: endpoints and response shapes

Part of the `api-conventions` skill ([SKILL.md](../SKILL.md)). The error codes are in SKILL.md, *Validation and errors*.

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
