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

The inputs are plain types in `scheduling/types.ts`, never Prisma types, so Prisma rows fit them as they are. Every check (`validateBooking`, `canMarkDayOff`, `canCancel`) returns a result instead of throwing: `{ ok: true, ... }` or `{ ok: false, code, message, details? }`, where `code` is an error code from `api-conventions` and `message` is in Bulgarian. The route throws `new AppError(code, message, details)` from a failure. The overlap rule and the 30-minute grid live in `scheduling/intervals.ts`, shared by the slots and the booking check.

## Time model

| Value | Stored as |
|-------|-----------|
| Booking `startAt` / `endAt` | UTC `DateTime` |
| Working hours | minutes from midnight, Sofia local time (`startMin`, `endMin`) |
| Day off, `date` query param | Sofia-local `YYYY-MM-DD` string |
| API responses | UTC ISO strings |

The slot grid is 30 minutes, aligned to the Sofia clock (:00 and :30). Working hours are saved only on 30-minute boundaries, and the API rejects any other value. Daylight-saving days are handled by building local times and converting them through `lib/time.ts`. Never add fixed offsets. On the spring switch day a local time between 03:00 and 04:00 does not exist, and `sofiaToUtc` moves it forward by the gap. On the autumn switch day such a time happens twice, and `sofiaToUtc` takes the first occurrence.

## `calculateAvailableSlots(service, date, workingHours, daysOff, bookings, now)`

The function returns the free start times as UTC ISO strings, in ascending order. It applies these steps in order:

1. If `date` is in `daysOff`, return `[]`.
2. If the weekday of `date` has no working hours, return `[]`.
3. Generate start times every 30 minutes from `startMin`.
4. Keep a start time only if `start + service.durationMin <= endMin`.
5. Drop a start time if `[start, start + duration)` overlaps any booking with status `BOOKED`. Two intervals overlap when `a.start < b.end && b.start < a.end`, so back-to-back bookings do not overlap.
6. Drop start times that are not after `now`.

The slots endpoint responds with `{ date, dayOff: boolean, slots: string[] }`.

## `validateBooking({ manicuristId, service, startAt, workingHours, daysOff, bookings, now })`

The server re-checks everything and never trusts the client. `service` is `null` when it does not exist. On success the function returns `{ ok: true, endAt }`. Return the first failure found:

| Check | Code | HTTP |
|-------|------|------|
| The service exists and belongs to the manicurist | `NOT_FOUND` | 404 |
| The date is not a day off | `DAY_OFF` | 409 |
| The start is on the grid and the whole duration fits inside working hours | `SLOT_INVALID` | 400 |
| The start is after `now` | `SLOT_INVALID` | 400 |
| No overlap with an active booking | `SLOT_TAKEN` | 409 |

The date and time of the start are its Sofia date and minutes (`utcToSofia`). A start is on the grid only when its minutes are a multiple of 30 and `sofiaToUtc` gives back the same instant. This rejects seconds and the second occurrence of a repeated local hour, which `calculateAvailableSlots` never offers either.

`POST /api/bookings` loads the data, validates and inserts inside one `prisma.$transaction`. The client never sends `endAt`. The server computes it from the service duration. If two clients race for the same slot, the loser gets `409 SLOT_TAKEN`.

## Days off

`canMarkDayOff(date, daysOff, bookings, now)` checks the allowed date, one per date and existing bookings, in this order. The caller passes only the active days off. It is generic over the booking type and returns the bookings on that date in `details.bookings` as they were passed, so the route keeps their id, service and client.

- **Allowed dates:** only today or a future date, in Sofia time. Anything else is `SLOT_INVALID`, with a message about the date.
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
- each `validateBooking` rejection.

**Supertest API tests:**
- `POST /api/bookings` returns 201;
- booking a taken slot returns 409 `SLOT_TAKEN`;
- booking a day off returns 409 `DAY_OFF`;
- a cancel by a non-owner returns 403;
- marking a day off on a date with bookings returns 409.
