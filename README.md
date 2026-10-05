# nAIlbook

A manicure booking platform. Clients find a manicurist by city and service, see the real free slots and book. Manicurists manage their services, weekly working hours and days off.

> **Status:** in development.

## Getting started

Requires Node 24.

```
npm install
cp client/.env.example client/.env
cp server/.env.example server/.env

cd server
npx prisma generate        # generates the Prisma client into src/generated/
npx prisma migrate dev     # creates server/dev.db and applies the migrations
npx prisma db seed         # demo data; safe to run again, it clears the data first
cd ..

npm run dev                # server on :3000, client on :5173
npm test                   # server tests, against a separate test.db
```

## Demo accounts

The seed creates these accounts. All of them use the password `nailbook123`.

| Role | Email | Name | City |
|------|-------|------|------|
| Client | client@example.com | Анна Иванова | |
| Manicurist | maria@example.com | Мария Петрова | София |
| Manicurist | elena@example.com | Елена Георгиева | София |
| Manicurist | iva@example.com | Ива Димитрова | Пловдив |
| Manicurist | desislava@example.com | Десислава Стоянова | Пловдив |
| Manicurist | gabriela@example.com | Габриела Николова | Велико Търново |

The client has a past and an upcoming booking with Мария Петрова, and Мария has a day off on a Wednesday 7–13 days after the seed runs. All names, emails and phone numbers are fake.

## Reset the demo data locally

The database (`server/dev.db`) is never committed, so every clone starts with its own clean data. To go back to the demo state, run this in `server/`:

```
npx prisma db seed
```

It deletes all rows, including accounts, bookings and days off created while testing, and creates the demo data again with dates relative to today. If the database itself is broken, for example after a schema change, rebuild it from the migrations first:

```
npx prisma migrate reset   # drops the database and reapplies the migrations
npx prisma db seed         # reset does not run the seed in Prisma 7
```

## Stack

- **Client:** React, TypeScript, Vite, React Router, Tailwind
- **Server:** Node.js, Express, TypeScript, Prisma, SQLite
- **Auth:** JWT and bcrypt
- **Validation:** zod
- **Tests:** Vitest, Supertest

## Documentation

- [docs/architecture.md](docs/architecture.md): modules, ownership and build order
- [.claude/skills/](.claude/skills/): implementation rules for scheduling, the API, the data model, the UI and tests
- [.github/copilot-instructions.md](.github/copilot-instructions.md): UI rules for GitHub Copilot
