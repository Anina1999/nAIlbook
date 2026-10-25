# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

nAIlbook is a manicure booking platform. Clients find a manicurist by city and service, see the real free slots and book. Manicurists manage their services, weekly hours and days off.

## Sources

[docs/architecture.md](docs/architecture.md) (modules, ownership, build order) and the project skills are the technical source of truth. Read the matching skill before you change its area:

| Skill | Use it for |
|-------|------------|
| `api-conventions` | Module layout, zod validation, the error shape and codes, JWT auth, roles and ownership, the endpoint list, API tests |
| `data-model` | `schema.prisma`, migrations, field conventions, the seed, Prisma queries |
| `scheduling-engine` | Free-slot calculation, booking validation, days off, cancel rules, the time model |
| `ui-conventions` | Everything in `client/` |
| `ui-design` | How the client looks and how its text reads: colour and font tokens, spacing, components, states, motion, UI wording |
| `testing` | Test layout, Vitest config, the test database, helpers, dates in tests, the Postman collection |

If the code has to differ from a skill, stop and ask. When the change is agreed, update the skill in the same change.

`.github/copilot-instructions.md` mirrors `ui-conventions` for Copilot. Whenever `ui-conventions` changes, update the mirrored sections (Structure, Screens, UI rules) in the same change, so Copilot never works from old rules.

## Stack

| Part | Technologies |
|------|--------------|
| Client (`client/`) | React, TypeScript, Vite, React Router, Tailwind |
| Server (`server/`) | Node.js, Express, TypeScript, Prisma, SQLite |
| Auth | JWT and bcrypt |
| Validation | zod |
| Tests | Vitest, Supertest |
| Approved extras | `cors` (server), `tsx` (server dev runner), `concurrently` (root, runs client and server together), `@prisma/adapter-better-sqlite3` + `better-sqlite3` (server, the SQLite driver Prisma 7 requires), the Sofia Sans font from Google Fonts (client, a `<link>` in `index.html`, see `ui-design`) |

Ask before adding a dependency that is not on this list. Type packages (`@types/*`) and build plugins for the listed tools (`@vitejs/plugin-react`, `@tailwindcss/vite`) count as part of the stack.

## Commands

Node 24, npm workspaces (`client`, `server`). Copy `client/.env.example` and `server/.env.example` to `.env` before the first run.

```
npm install              # in the root, installs client and server
npm run dev              # starts the server (:3000) and the client (:5173) together
npm test                 # runs all tests (server Vitest)
npx vitest run tests/api/auth        # in server/; one test file
npx vitest run -t "duplicate email"  # in server/; tests whose name matches
npm run typecheck -w server   # or -w client; tsc --noEmit
npm run build -w client       # production build of the client
npx prisma generate      # in server/; after install and after every schema change
npx prisma migrate dev --name <verb_what>   # in server/; e.g. add_deleted_at_to_day_off, see data-model
npx prisma db seed       # in server/; demo data, clears all rows first
npx prisma migrate reset # in server/; rebuilds dev.db from the migrations; run the seed after it
```

Tests never touch `dev.db`. `server/vitest.config.ts` points `DATABASE_URL` to `test.db`, and `tests/setup/global-setup.ts` recreates it with `prisma migrate deploy` before each run. A schema change reaches the tests only through a migration. Test files run one at a time, because they share that one file.

Prisma is 7.x: the config is in `server/prisma.config.ts`, the client is generated into `server/src/generated/prisma/` (gitignored) and the app imports it through `server/src/lib/prisma.ts`. Never run `prisma init` in the project, because it adds Prisma's own skill files to `.claude/skills/`.

## Server rules not covered by the skills

- **`app.ts` builds the app, `index.ts` starts it.** `server/src/app.ts` sets up middleware and routers and exports `app` without calling `listen`, so Supertest can import it. Only `server/src/index.ts` calls `listen`. Mount each new module router in `app.ts` under `/api/<module>`, before `notFound` and `errorHandler`.
- **Express 5 handles async errors.** A route handler or middleware just throws an `AppError` (or lets a rejected promise escape). Express 5 passes it to `errorHandler`, so handlers have no `try/catch` and no `next(err)`.
- **ESM imports end in `.js`.** The server is `"type": "module"`, so relative imports name the compiled file: `import { app } from './app.js'`, even though the source is `app.ts`.

## How to work

- **One module at a time.** Follow the build order in architecture.md. Do not start the next module unless asked.
- **Tests go with the code.** A module is not done until its tests pass. Run the tests before you say a task is finished.
- **Small, reviewable steps.** After each step, summarize what changed and what to check. Suggest a commit message, and commit only when asked.
- **Stay in scope.** Build only what architecture.md and the skills describe. Ask before adding a feature they do not cover.
- **Never simplify away** free-slot calculation or server-side booking validation.
- **Language.** Code, comments, commit messages and docs are in English. UI text is in Bulgarian.
- **No secrets in the repo.** Never commit secrets: use `.env`, which is gitignored, and keep `.env.example` up to date.

## Skills and agents

Project skills live in `.claude/skills/<name>/SKILL.md` and project agents in `.claude/agents/<name>.md`. Implementation rules belong in a skill or in architecture.md, not only in this file.

| Agent | Owns | Reads skills |
|-------|------|--------------|
| `backend-developer` | `server/`, `docs/postman/` | `api-conventions`, `data-model`, `scheduling-engine`, `testing` |
| `frontend-developer` | `client/` | `ui-conventions`, `ui-design`, plus the server skills to use the API correctly |

Each agent reads a skill when its task touches that area. Neither edits `.claude/`, `.github/`, this file, `docs/architecture.md`, the root `package.json` or the lock file. Neither installs packages, runs the dev server or commits.

### A feature with both agents

When a feature needs both the server and the client:

1. **Agree on the API contract first.** Take the endpoints, request and response shapes and error codes from `api-conventions`. If the feature needs something the skill does not have yet, such as a response shape, agree it with the user and write it into the skill before the agents start.
2. **Start both agents in parallel.** Give each one the feature, its part and the same contract. They touch separate folders, so they do not block each other.
3. **Check the result.** Read both reports, then run `npm test`, `npm run typecheck -w server`, `npm run typecheck -w client` and `npm run build -w client`, and try the feature by hand.
4. **Handle the open points.** Take the agents' questions and skill proposals to the user. A proposed skill is created or extended only after the user agrees, in the same change as the code it affects. If the backend report shows an API that differs from the contract, either the code or `api-conventions` changes in the same change.

A feature that touches only one side uses only that agent.
