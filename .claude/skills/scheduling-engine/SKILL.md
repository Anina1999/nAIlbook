---
name: scheduling-engine
description: Rules for nAIlbook's free-slot calculation, booking validation, days off and cancellation. Use whenever writing or changing code in server/src/scheduling/ or server/src/modules/bookings/, the slots endpoint, the days-off endpoints or their tests. Also use before answering any question about when a slot is free or when a booking, day off or cancel is allowed.
---

# Scheduling & booking engine

This is the core of nAIlbook. The rules below are the specification. Do not relax them to make a test or a UI flow easier.

## Purity

`server/src/scheduling/` contains pure functions only:
- no Prisma, no Express, no `Date.now()`;
- `now` is always passed in as a parameter;
- all timezone work goes through `server/src/lib/time.ts`.

Route handlers load the data, call these functions and map the result to HTTP.

The inputs are plain types in `scheduling/types.ts`, never Prisma types, so Prisma rows fit them as they are. Every check (`validateBooking`, `canMarkDayOff`, `canCancel`) returns a result instead of throwing: `{ ok: true, ... }` or `{ ok: false, code, message, details? }`, where `code` is an error code from `api-conventions` and `message` is in Bulgarian. The route throws `new AppError(code, message, details)` from a failure. The overlap rule, the 30-minute grid and the booking ends (`bookingEnds`, `isBookingEnd`) live in `scheduling/intervals.ts`, shared by the slots and the booking check.

## Time model

| Value | Stored as |
|-------|-----------|
| Booking `startAt` / `endAt` | UTC `DateTime` |
| Working hours | minutes from midnight, Sofia local time (`startMin`, `endMin`) |
| Day off, `date` query param | Sofia-local `YYYY-MM-DD` string |
| API responses | UTC ISO strings |

The slot grid is 30 minutes, aligned to the Sofia clock (:00 and :30). Working hours are saved only on 30-minute boundaries, and the API rejects any other value. Service durations are multiples of 5 minutes, so a booking can end off the grid; the exact end of an active booking is a start too (see below), so a day can be booked without gaps. Daylight-saving days are handled by building local times and converting them through `lib/time.ts`. Never add fixed offsets. On the spring switch day a local time between 03:00 and 04:00 does not exist, and `sofiaToUtc` moves it forward by the gap. On the autumn switch day such a time happens twice, and `sofiaToUtc` takes the first occurrence.

## The 12-month limit

A booking or a day off is allowed up to `lastBookableDate(now)` in `scheduling/intervals.ts`: today in Sofia plus `MAX_MONTHS_AHEAD` (12) calendar months, inclusive. It is the same day of the month; a shorter target month uses its last day, so 29 February becomes 28 February (`addMonths` in `lib/time.ts`). The check compares Sofia dates, never the UTC date of `now`. The public days-off list does not change: dates after the limit just never exist. `sofiaDayRange(date)` in `lib/time.ts` gives the `[from, to)` UTC range of a Sofia date, for the queries that load a day's bookings.

## `calculateAvailableSlots(service, date, workingHours, daysOff, bookings, now)`

The function returns the free start times as UTC ISO strings, in ascending order. It applies these steps in order:

1. If `date` is after `lastBookableDate(now)`, return `[]` (see "The 12-month limit").
2. If `date` is in `daysOff`, return `[]`.
3. If the weekday of `date` has no working hours, return `[]`.
4. Generate the candidates: the start times every 30 minutes from `startMin`, plus the `endAt` of every `BOOKED` booking whose end is on that Sofia date and whose local minutes are inside `[startMin, endMin)`. A candidate from a booking end is that `endAt` instant itself, never rebuilt through `sofiaToUtc`. The end of a `CANCELLED` booking is never a candidate.
5. Keep a candidate only if `start + service.durationMin <= endMin` (in Sofia minutes).
6. Drop a candidate if `[start, start + duration)` overlaps any booking with status `BOOKED`. Two intervals overlap when `a.start < b.end && b.start < a.end`, so back-to-back bookings do not overlap.
7. Drop candidates that are not after `now`.
8. Return them without duplicates (a booking end on the grid appears once), sorted ascending.

The slots endpoint responds with `{ date, dayOff, slots, busy }` (see "The slots endpoint").

## The slots endpoint

`GET /api/manicurists/:id/slots?serviceId=&date=` answers `200 { date, dayOff: boolean, slots: string[], busy: { startAt, endAt }[] }`.

- `slots` comes from `calculateAvailableSlots` for the service. `serviceId` is optional: without it `slots` is `[]`, and only the manicurist has to exist (`404 NOT_FOUND` «Маникюристът не е намерен.» for an unknown id or a user who is not a manicurist). An unknown, removed or foreign service is `404 NOT_FOUND`. `date` is required.
- `busy` lists the active `BOOKED` bookings on that Sofia date (the same ones the checks load), ordered by `startAt`, as UTC ISO strings with exactly the keys `startAt` and `endAt`: no id, no names, no service, because the endpoint is public. Cancelled bookings are not in it.
- A day off is `{ date, dayOff: true, slots: [], busy: [] }`. A date after the 12-month limit is `{ date, dayOff: false, slots: [], busy: [] }`.

## `validateBooking({ manicuristId, service, startAt, workingHours, daysOff, bookings, now })`

The server re-checks everything and never trusts the client. `service` is `null` when it does not exist or is removed (`deletedAt` set). On success the function returns `{ ok: true, endAt }`. Return the first failure found:

| Check | Code | HTTP |
|-------|------|------|
| The service exists and belongs to the manicurist | `NOT_FOUND` | 404 |
| The date is not a day off | `DAY_OFF` | 409 |
| The whole duration fits inside working hours, and the start is on the grid or exactly the end of an active booking | `SLOT_INVALID` | 400 |
| The start is after `now` | `SLOT_INVALID` | 400 |
| The Sofia date of the start is not after `lastBookableDate(now)` | `SLOT_INVALID` | 400 |
| No overlap with an active booking | `SLOT_TAKEN` | 409 |

The date and time of the start are its Sofia date and minutes (`utcToSofia`). A start is on the grid only when its minutes are a multiple of 30 and `sofiaToUtc` gives back the same instant. This rejects seconds and the second occurrence of a repeated local hour on the grid, which `calculateAvailableSlots` never offers either.

A start off the grid is valid only when it equals exactly the `endAt` of an active (`BOOKED`) booking on that Sofia date (`isBookingEnd`). That holds in the repeated autumn hour too: a booking that ends in the second occurrence of 03:00–04:00 makes that instant a valid start, as `calculateAvailableSlots` offers it. A booking that was valid only because the booking before it existed gets `400 SLOT_INVALID` once that booking is cancelled.

The `SLOT_INVALID` row has two messages, checked in this order:
- the service does not fit inside the working hours (or the weekday has none): «Този час е извън работното време. Изберете свободен час.»;
- it fits, but the start is neither on the grid nor the end of an active booking: «Този час не е свободен. Изберете друг свободен час.».

`POST /api/bookings` loads the data, validates and inserts inside one `prisma.$transaction`. The client never sends `endAt`. The server computes it from the service duration. If two clients race for the same slot, the loser gets `409 SLOT_TAKEN`.

## Days off

`canMarkDayOff(date, daysOff, bookings, now)` checks the allowed date, one per date and existing bookings, in this order. The caller passes only the active days off. It is generic over the booking type and returns the bookings on that date in `details.bookings` as they were passed, so the route keeps their id, service and client.

- **Allowed dates:** only today or a future date, in Sofia time, up to `lastBookableDate(now)`. A past date is checked first, then a date after the limit, both before `ALREADY_DAY_OFF`. Anything else is `SLOT_INVALID`, with a message about the date.
- **Active days off only:** a day off counts only while `deletedAt` is null. Load days off with `deletedAt: null` everywhere they are used.
- **One per date:** a second active day off for the same date returns `409 ALREADY_DAY_OFF`. If the date has a removed row, marking it again clears `deletedAt` on that row.
- **Existing bookings:** if `BOOKED` bookings exist on that Sofia date, return `409 DAY_HAS_BOOKINGS` with `details.bookings`. Do not cancel them automatically.
- **Removing:** deleting a day off sets `deletedAt` and reopens the date. The row is never deleted. Only the owning manicurist can remove it.

## Cancel

`canCancel(booking, userId, now)` returns `{ ok: true, cancelledBy }`. It checks who before what, so a stranger learns nothing about the booking.

- **Who:** only the booking's client or its manicurist can cancel. Anyone else gets `403 FORBIDDEN`.
- **What:** only a booking with status `BOOKED` and `startAt > now` can be cancelled. Anything else gets `409 NOT_CANCELLABLE`.
- **Reason:** every cancel, by the client or the manicurist, needs a reason. The route validates it with zod (trimmed, 1–200 characters) before any other check; `canCancel` does not see it.
- **Effect:** set `status = CANCELLED`, `cancelledBy = CLIENT | MANICURIST` and `cancelReason`. Never delete the row.

## Required tests

The test setup (database, helpers, dates) is in the `testing` skill.

**Vitest unit tests** for the pure functions. They need no database:
- a normal day;
- a day off returns `[]`;
- a weekday without working hours returns `[]`;
- a service longer than the remaining time;
- overlap with a booking;
- back-to-back bookings are allowed;
- past slots on today's date are dropped;
- a cancelled booking does not block a slot;
- each `validateBooking` rejection;
- a start at the end of a 40-minute booking is offered and accepted; not offered when the service does not fit before the next booking or the end of the day; the end of a cancelled booking is neither offered nor accepted; no duplicate when the end is on the grid; sorted when an end falls between grid starts; both daylight-saving switch days with a booking end off the grid;
- `validateBooking` agrees with `calculateAvailableSlots` on every grid start and every booking end of a day.

**Supertest API tests:**
- `/slots` returns `busy` with exactly `startAt` and `endAt`, ordered, without cancelled bookings; without `serviceId` it returns `slots: []` and the busy intervals, and `404 NOT_FOUND` for an unknown manicurist;
- `POST /api/bookings` returns 201, also exactly at the end of a 40-minute booking; 400 `SLOT_INVALID` there once that booking is cancelled;
- a race for the start at the end of a booking gives one booking and `SLOT_TAKEN` for the rest (on the service, see `testing`);
- booking a taken slot returns 409 `SLOT_TAKEN`;
- booking a day off returns 409 `DAY_OFF`;
- a cancel by a non-owner returns 403;
- marking a day off on a date with bookings returns 409.
