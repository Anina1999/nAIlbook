---
name: data-model
description: nAIlbook's Prisma + SQLite data model, field conventions and seed data. Use when changing server/prisma/schema.prisma, creating a migration, editing the seed, or writing any Prisma query.
---

# Data model

The database is SQLite through Prisma. The schema lives in `server/prisma/schema.prisma` and the seed in `server/prisma/seed.ts`.

## Models

```
User              id, email (unique), passwordHash, name, phone,
                  role (CLIENT | MANICURIST | ADMIN), tokenVersion (Int, default 0),
                  createdAt, updatedAt
ManicuristProfile userId (PK, FK User), city, address, bio, imageUrl?, updatedAt
Service           id, manicuristId (FK), name, description?, durationMin, priceCents, updatedAt
WorkingHours      id, manicuristId (FK), weekday (0–6, 0 = Sunday), startMin, endMin, updatedAt
                  unique(manicuristId, weekday)
DayOff            id, manicuristId (FK), date (String "YYYY-MM-DD", Sofia local), createdAt,
                  deletedAt?
                  unique(manicuristId, date)
Booking           id, clientId (FK), manicuristId (FK), serviceId (FK),
                  serviceName, priceCents (copied from the service when booking),
                  startAt, endAt (UTC DateTime), status (BOOKED | CANCELLED),
                  cancelledBy (CLIENT | MANICURIST)?, createdAt, updatedAt
                  index(manicuristId, startAt)
```

`manicuristId` always points to `ManicuristProfile.userId`, so only a manicurist can own services, hours, days off and bookings. IDs are autoincrement `Int`.

`updatedAt` uses Prisma's `@updatedAt` on every model that can be edited. `DayOff` has none, because a day off is only added or removed; `deletedAt` records the removal. On a booking, `updatedAt` shows when it was cancelled.

## Conventions

- **No extra statuses.** There is no `PENDING` or `COMPLETED`. Bookings are confirmed instantly, and a booking counts as past when `endAt < now`.
- **Units:**
  - durations and working hours are in minutes;
  - prices are whole euro cents in an `Int` (`priceCents`), everywhere: the database, the API and the client state. The client divides by 100 only to display a price and multiplies by 100 on input. Do not use `Decimal`, because Prisma serializes it as a string in JSON.
- **Enums:** `role`, `status` and `cancelledBy` use Prisma enums if the installed Prisma version supports them on SQLite. Otherwise use `String` and validate the values with zod.
- **`tokenVersion`** is copied into every JWT. Logout increments it, which revokes all of the user's tokens (see `api-conventions`). Nothing else changes it.
- **No hard deletes for bookings.** Cancelling sets `status = CANCELLED`.
- **Booking snapshot.** When a booking is created, copy the service's `name` and `priceCents` into `serviceName` and `priceCents`. Show and report these, not the current service values, so later price or name changes do not rewrite history. The duration is already fixed by `startAt` and `endAt`.
- **Days off are soft-deleted.** Removing a day off sets `deletedAt`. Every read of days off (slots, booking validation, the public list, `/me/days-off`) filters `deletedAt: null`. Marking a date that has a removed row clears `deletedAt` on that row instead of inserting, because `(manicuristId, date)` is unique.
- **Prisma is limited to modules.** Prisma calls belong in `service.ts` files and never in `server/src/scheduling/`.
- **Schema changes:**
  - change the schema with `npx prisma migrate dev --name <change>`;
  - name every migration for what it does, in `snake_case`, starting with a verb: `add_booking_price_snapshot`, `add_deleted_at_to_day_off`, `rename_service_price`. Never use a generic name such as `init`, `update`, `changes` or `fix`. Prisma adds the timestamp in front;
  - never edit applied migrations;
  - update the seed in the same change.

## Seed

The seed must give a working demo right after install:
- about 5 manicurists in 2–3 cities (for example Sofia, Plovdiv and Veliko Tarnovo), each with 2–4 services and working hours;
- at least one future day off;
- one client account with a past booking and an upcoming booking.

Demo account passwords are listed only in the README. Use fake names, emails and phone numbers, never real personal data.
