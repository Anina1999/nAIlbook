# Copilot instructions for nAIlbook

nAIlbook is a manicure booking platform: a React client (`client/`) and an Express REST API (`server/`). Copilot is used for the client.

## Source of truth

Read these before changing anything in `client/`:

- [.claude/skills/ui-conventions/SKILL.md](../.claude/skills/ui-conventions/SKILL.md): structure, screens and UI rules
- [docs/architecture.md](../docs/architecture.md): modules and how they connect

The UI sections below mirror the skill. If they disagree, the skill wins. When the skill changes, this file is updated in the same change.

## Structure

```
client/src/
  api/          typed fetch wrapper + one file per resource (auth, manicurists, bookings, me)
  context/      AuthContext (user, token, login, logout)
  pages/        one file per screen
  components/   shared pieces (SlotPicker, DatePicker, BookingList, ...)
```

**API wrapper:**
- reads `VITE_API_URL`;
- attaches `Authorization: Bearer <token>`;
- on an error, parses `{ error: { code, message, details } }` and throws an `ApiError` with those fields.

Components call the wrapper in `client/src/api/`, never a raw `fetch`.

**Auth state:** the token is kept in `localStorage` and loaded at startup through `GET /api/auth/me`. A 401 logs the user out. Logout first calls `POST /api/auth/logout`, which revokes the token on the server, and then clears `localStorage`. Clear it even when the call fails.

## Screens

| Path | Who | Content |
|------|-----|---------|
| `/` | anyone | Search by city and service. Results are cards. |
| `/manicurists/:id` | anyone | Profile, services, date picker, free slots and a Book button (a guest is sent to login) |
| `/login`, `/register` | guest | Registration asks for the account type: client or manicurist (business). For a manicurist, city and address (required) and bio (optional) appear on the same form. They can be edited later on `/profile`. |
| `/my-bookings` | client | Upcoming bookings with Cancel, and past bookings |
| `/schedule` | manicurist | Bookings for the selected day, with Cancel |
| `/days-off` | manicurist | Add or remove days off. The `DAY_HAS_BOOKINGS` warning lists the conflicting bookings. |
| `/profile`, `/services`, `/hours` | manicurist | Editors |

## UI rules

- **The client never decides a slot is free.** It shows only what `/slots` returns. On `409 SLOT_TAKEN` or `DAY_OFF`, show the message and reload the slots.
- **Disabled dates in the picker:** past dates, days off from `/days-off` and weekdays without working hours.
- **Text:** all UI text is in Bulgarian. Code identifiers and comments stay in English.
- **Dates and times:** format with `Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia' })`, and send dates to the API as `YYYY-MM-DD`.
- **Prices:** show prices as `35 €`.
- **Errors:** show the server's `message`. Show field errors from `VALIDATION_ERROR` next to their inputs.
- **Responsive layout:** design mobile-first with Tailwind. Every screen must work at 375px width.
- **Accessibility basics:** every input has a label, buttons are real `<button>` elements, and disabled dates and slots are actually `disabled`.

## Project rules

- **Stack:** React, TypeScript, Vite, React Router, Tailwind. Ask before adding any other dependency.
- **Do not change `server/`** from Copilot sessions.
- **No secrets** in code or committed files. Use `.env`, which is gitignored.
