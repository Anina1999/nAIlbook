---
name: refactor
description: How to plan and run a behaviour-preserving refactor in nAIlbook, covering logic that sits in the wrong file, handlers and functions worth extracting for reuse, common code smells, the plan format and small verified steps. Use when the user asks to refactor, clean up, split, move or extract code in server/ or client/, or asks whether a file has grown too big or the structure is followed (a check-only report). Not for new features or bug fixes.
---

# Refactor

A refactor changes the structure of the code, never its behaviour. Status codes, error codes, response shapes, messages, UI text and screens stay exactly the same. A refactor always starts with a plan the user approves, and then goes in small steps that each leave the tests green.

## Rules

- **No behaviour change.** If a step would change what the API returns or what the UI shows, it is not part of the refactor. Stop and ask.
- **The API is a contract.** Endpoints, response shapes and error codes stay as in `api-conventions`.
- **Never simplify away** the free-slot calculation or server-side booking validation. `scheduling/` stays pure, as `scheduling-engine` says.
- **Do not mix work.** A bug or a missing feature found during the refactor is reported, not fixed in the same step. It gets its own change.
- **Tests keep their meaning.** A test may change only its import path when the code it tests moves. Never change an assertion, delete a test or add `.skip`.
- **The skills decide where code lives.** If the best home for the code is a place the skills do not describe (for example a new `client/src/hooks/` folder), stop and ask. When the user agrees, update that skill in the same change. A change to `ui-conventions` also updates `.github/copilot-instructions.md`.
- **No new dependencies**, as in `CLAUDE.md`.
- **Only code that changes.** Refactor the area the user named, or the files that recent work keeps touching. Do not tidy code that nobody edits.

## Process

**Check only.** When the user asks only for a check ("провери структурата на server/", "има ли логика не на място"), run steps 1 and 2, then stop. Report the findings in the chat, grouped by check (a, b, c), each with its file:line, where the code should move and a strength: `Strong`, `Worth doing` or `Minor`. Change no code and write no plan. The user decides which findings become a refactor, and that refactor continues from step 3 with the chosen findings.

### 1. Pin the target

Ask what the user wants to improve and why, unless they already said. Read the skills of that area (`api-conventions`, `scheduling-engine`, `ui-conventions` and so on) before you read the code.

### 2. Explore and check

Read the files and check the user's description against the code. Then go through the three checks below. Write down each finding with its file and line.

#### a. Logic outside the file's scope

Each file has one job, set by the layout in the skills:

| File | Its job | Signs that it holds too much |
|------|---------|------------------------------|
| `modules/<m>/routes.ts` | parse → call the service → respond | Prisma calls, business rules, building objects that belong to the service |
| `modules/<m>/service.ts` | business logic and Prisma calls | reads `req`/`res`, sets HTTP statuses, holds slot or booking rules that belong in `scheduling/` |
| `modules/<m>/schemas.ts` | zod schemas | logic other than validation |
| `middleware/*.ts` | auth, role checks and error handling for every request | business rules, module logic, Prisma queries other than loading the user in `requireAuth` |
| `scheduling/*.ts` | pure rules | Prisma, Express, `Date.now()`, timezone maths outside `lib/time.ts` |
| `lib/*.ts` | small shared helpers | code that only one module uses, module logic |
| `client/src/pages/*.tsx` | one screen | raw `fetch`, long formatting or parsing helpers, a piece of UI another screen also needs |
| `client/src/components/*.tsx` | one shared piece | API calls or screen-specific state that belong in the page |
| `client/src/api/*.ts` | typed calls to one resource | UI state, formatting for display |

For each sign, say where the logic should move and why.

#### b. Handlers and reusable functions

Look for code that is written more than once, or that would be clearer under its own name:

- route handlers that repeat the same steps (load the row, check the owner, throw `NOT_FOUND` or `FORBIDDEN`);
- client handlers (`onSubmit`, `onChange`, loading and error state) copied between pages or forms;
- the same calculation, mapping or formatting in more than one file (dates, prices, a user without private fields).

Extract a function when two or more places use it, or when extracting it gives a file back its single job. Do not extract a one-off for a use that may come later, and do not add a wrapper that only passes its arguments on.

Where it goes:

- **server:** inside the module when only that module uses it, `server/src/lib/` when several modules do, `scheduling/` when it is a slot or booking rule;
- **client:** `components/` for UI, `api/` for calls. A shared hook or a non-UI helper has no folder in `ui-conventions` yet, so ask first (see Rules).

#### c. Code smells

Treat these as hints, never as hard violations. A rule in a skill always wins.

- **Mysterious name:** the name does not say what the code does. Rename it.
- **Duplicated code:** the same shape in two places. Extract it (see b).
- **Long function:** one function does several steps. Split it into named steps.
- **Long parameter list / data clump:** the same few values always travel together. Give them one type.
- **Primitive obsession:** a string or number stands for a domain idea (a status, a Sofia date). Use the existing type or a union.
- **Repeated switch:** the same `if`/`switch` on the same value in several places. Use one shared map or function.
- **Feature envy:** a function mostly works with another module's data. Move it there.
- **Speculative generality:** parameters, options or abstractions nothing uses. Remove them.

### 3. Check the tests

Find the tests that cover the code (`server/tests/unit/`, `server/tests/api/`, see `testing`). If the behaviour the refactor touches is not tested, the first step of the plan adds tests for the current behaviour, and they must pass before any code moves. The client has no unit tests, so a client refactor lists the screens and flows to check by hand on desktop and at 375px.

### 4. Present the plan and wait

Write the plan in the chat and wait for the user's approval:

```
Refactor plan: <short name>

Problem: <what is wrong now, with files>
Findings: <scope, reuse and smell findings, one line each with file:line>
In scope: <what changes>
Out of scope: <what stays, including bugs found on the way>
Tests: <existing tests that cover it, tests to add first>
Skills affected: <skill and the line to update, or "none">

Steps:
1. <one small change> — files: … — check: … — commit: "<message>"
2. …
```

Each step is one small move (extract, move, rename, inline) that leaves the app working. If a step needs more than a few files, split it.

### 5. Run the steps

For each step:

1. Make only that step's change.
2. Run in the project root: `npm test`, `npm run typecheck -w server` and, when `client/` changed, `npm run typecheck -w client` and `npm run build -w client`.
3. If a check fails, fix the step or undo it. Never fix it by changing a test's meaning.
4. Summarize what moved and what to check, and suggest the commit message. Commit only when the user asks.

When the work is split between agents, `backend-developer` takes the steps in `server/` and `frontend-developer` the steps in `client/`, with the approved plan as the brief.
