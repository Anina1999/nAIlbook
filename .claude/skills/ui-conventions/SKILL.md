---
name: ui-conventions
description: Conventions for nAIlbook's React client, covering folder structure, the API wrapper, auth state, Bulgarian UI text, date and time display, slot picker behaviour, error handling and responsive Tailwind layout. Use when building or changing anything in client/.
---

# UI conventions

The stack is React, TypeScript, Vite, React Router and Tailwind CSS.

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
