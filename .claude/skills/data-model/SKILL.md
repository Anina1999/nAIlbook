---
name: data-model
description: nAIlbook's Prisma + SQLite data model, field conventions and seed data. Use when changing server/prisma/schema.prisma, creating a migration, editing the seed, or writing any Prisma query.
---

# Data model

The database is SQLite through Prisma. The schema lives in `server/prisma/schema.prisma` and the seed in `server/prisma/seed.ts`.

## Models

```
User              id, email (unique), passwordHash, name, phone,
                  role (CLIENT | MANICURIST | ADMIN), createdAt
ManicuristProfile userId (PK, FK User), city, address, bio, imageUrl?
Service           id, manicuristId (FK), name, description?, durationMin, priceEur
WorkingHours      id, manicuristId (FK), weekday (0–6, 0 = Sunday), startMin, endMin
                  unique(manicuristId, weekday)
DayOff            id, manicuristId (FK), date (String "YYYY-MM-DD", Sofia local), createdAt
                  unique(manicuristId, date)
Booking           id, clientId (FK), manicuristId (FK), serviceId (FK),
                  startAt, endAt (UTC DateTime), status (BOOKED | CANCELLED),
                  cancelledBy (CLIENT | MANICURIST)?, createdAt
                  index(manicuristId, startAt)
```

## Conventions

- **No extra statuses.** There is no `PENDING` or `COMPLETED`. Bookings are confirmed instantly, and a booking counts as past when `endAt < now`.
- **Units:**
  - durations and working hours are in minutes;
  - prices are in EUR, stored as `Decimal` or as cents in an `Int`. Choose one and keep it everywhere.
- **Enums:** `role`, `status` and `cancelledBy` use Prisma enums if the installed Prisma version supports them on SQLite. Otherwise use `String` and validate the values with zod.
- **No hard deletes for bookings.** Cancelling sets `status = CANCELLED`.
- **Prisma is limited to modules.** Prisma calls belong in `service.ts` files and never in `server/src/scheduling/`.
- **Schema changes:**
  - change the schema with `npx prisma migrate dev --name <change>`;
  - never edit applied migrations;
  - update the seed in the same change.

## Seed

The seed must give a working demo right after install:
- about 5 manicurists in 2–3 cities (for example Sofia, Plovdiv and Veliko Tarnovo), each with 2–4 services and working hours;
- at least one future day off;
- one client account with a past booking and an upcoming booking.

Demo account passwords are listed only in the README. Use fake names, emails and phone numbers, never real personal data.
