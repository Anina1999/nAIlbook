# Copilot instructions for nAIlbook

nAIlbook is a manicure booking platform: a React client (`client/`) and an Express REST API (`server/`). Copilot is used for the client.

## Source of truth

Read these before changing anything in `client/`:

- [.claude/skills/ui-conventions/SKILL.md](../.claude/skills/ui-conventions/SKILL.md): structure, screens and UI rules
- [.claude/skills/ui-design/SKILL.md](../.claude/skills/ui-design/SKILL.md): colour and font tokens, spacing, components, states, motion and UI wording. Read it before you build or restyle a screen.
- [docs/architecture.md](../docs/architecture.md): modules and how they connect

The UI sections below mirror `ui-conventions`. If they disagree, the skill wins. When the skill changes, this file is updated in the same change.

## Structure

```
client/src/
  api/          typed fetch wrapper (client.ts) + one file per resource (auth, manicurists, bookings, me)
  contexts/     one pair per context: <Name>Context.ts (createContext and its type) + <Name>Provider.tsx (the state)
  hooks/        one hook per file (useAuth, useForm, useFrom, ...)
  components/   one folder per component, in kebab-case: <kebab-name>/<Name>.tsx + <Name>.module.css
    guards/     route guards as layout routes that render <Outlet /> (GuestGuard, ...)
  pages/        one folder per screen or group of screens: <page>/<Name>.tsx + <Name>.module.css
```

- **Every component and page has its own `.module.css`.** Screens that share a layout share one module: `pages/auth/Auth.module.css` serves `Login.tsx` and `Register.tsx`. How the styles are written (Tailwind `@apply` with the tokens) is in `ui-design`.
- **Logic goes into hooks.** State or logic that more than one component could use lives in a hook in `hooks/`, not in the component. Components read a context through its hook (`useAuth()`), never with `use(AuthContext)` directly. A hook is added when the first screen needs it, not in advance.
- **Shared components:** `layout/Layout` (header, the page column, `<Outlet />`), `header/Header`, `button/Button`, `form-field/FormField`, `error-message/ErrorMessage`, `loader/Loader` and `guards/GuestGuard`. Later screens add `SlotPicker`, `DatePicker`, `BookingList` and others the same way.
- **Routes** are in `App.tsx`: `AuthProvider` around `Routes`, every screen nested under the `Layout` route, guest-only screens under `GuestGuard`.

**API wrapper:**
- reads `VITE_API_URL`;
- attaches `Authorization: Bearer <token>`;
- on an error, parses `{ error: { code, message, details } }` and throws an `ApiError` with those fields and the HTTP status;
- when the request does not reach the server at all, throws an `ApiError` with the client-only code `NETWORK_ERROR` and the message «Няма връзка със сървъра. Проверете връзката и опитайте отново.»;
- when an error response has no `{ error }` body, throws an `ApiError` with `INTERNAL_ERROR` and `UNEXPECTED_ERROR_MESSAGE`, «Нещо се обърка. Опитайте отново.» A form shows the same text when its submit throws anything other than an `ApiError`.

Components call the wrapper in `client/src/api/`, never a raw `fetch`.

**Auth state:**
- Only the token is kept in `localStorage`, under the key `nailbook.token`. The user always comes from the server: from `GET /api/auth/me` at startup, and from the `{ token, user }` response after login or registration.
- At startup, while `/me` is pending, `loading` is true: the header shows «Зареждане…» instead of the guest menu, and `GuestGuard` shows the `Loader`. A 401 clears the token. Any other error leaves the user a guest and keeps the token for the next load.
- A `401 UNAUTHORIZED` on a request sent with a token logs the user out. `401 INVALID_CREDENTIALS` on login is sent without a token and only shows its message.
- Logout first calls `POST /api/auth/logout`, which revokes the token on the server, and then clears `localStorage`. Clear it even when the call fails. Then go to `/`. While the call runs, «Изход» is disabled and says «Излизане…».
- **Back to where the user came from.** A screen that sends a guest to login passes `state: { from: <path> }`. `useFrom()` reads it, with `/` as the default. After login or registration the user goes there; the links between `/login` and `/register` pass `state: { from }` on. `GuestGuard` sends a logged-in user to the same place, so a user who opens `/login` while logged in lands on `/`.

## Screens

| Path | Who | Content |
|------|-----|---------|
| `/` | anyone | Search by city and service. Results are cards. |
| `/manicurists/:id` | anyone | Profile, services, date picker, free slots and a Book button (a guest is sent to login) |
| `/login`, `/register` | guest | Registration asks for the account type: client or manicurist (business). For a manicurist, city and address (required) and bio (optional) appear on the same form. They can be edited later on `/profile`. |
| `/my-bookings` | client | Upcoming bookings with Cancel, and past bookings |
| `/schedule` | manicurist | Bookings for the selected day, with Cancel |
| `/days-off` | manicurist | Add or remove days off. The `DAY_HAS_BOOKINGS` warning lists the conflicting bookings. |
| `/profile` | logged in | Edit profile, for every role: email, phone (optional) and password. A client cannot change their name. A manicurist also edits name, city, address and bio here. The endpoints are agreed in the step that builds the screen. |
| `/services`, `/hours` | manicurist | Editors |

## UI rules

- **The client never decides a slot is free.** It shows only what `/slots` returns. On `409 SLOT_TAKEN` or `DAY_OFF`, show the message and reload the slots.
- **Disabled dates in the picker:** past dates, days off from `/days-off` and weekdays without working hours.
- **Text:** all UI text is in Bulgarian. Code identifiers and comments stay in English.
- **Dates and times:** format with `Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia' })`, and send dates to the API as `YYYY-MM-DD`.
- **Prices:** show prices as `35 €`.
- **Errors:** show the server's `message`. Show field errors from `VALIDATION_ERROR` next to their inputs: `details[].path` is the field name (`"city"`). A detail whose path has no visible field goes into the error box: `useForm`'s `submitHandler(onSubmit, visibleFields)` takes the fields shown right now (default: every field in `values`). A radio group is a visible field, so its error goes under the fieldset, linked with `aria-describedby`. Forms have `noValidate` and send every visible field as a string, even an empty one, so the errors come from the server.
- **Responsive layout:** design mobile-first with Tailwind. Every screen must work at 375px width.
- **Accessibility basics:**
  - every input has a label, buttons are real `<button>` elements, and disabled dates and slots are actually `disabled`;
  - every flow works with the keyboard alone, and focus is visible (`focus-visible:` ring classes, never `outline-none` without a replacement);
  - a button with only an icon has an `aria-label` in Bulgarian, and the icon has `aria-hidden="true"`;
  - text has a contrast of at least 4.5:1 against its background.

## Project rules

- **Stack:** React, TypeScript, Vite, React Router, Tailwind (applied with `@apply` in each component's CSS Module, see `ui-design`). Ask before adding any other dependency.
- **Do not change `server/`** from Copilot sessions.
- **No secrets** in code or committed files. Use `.env`, which is gitignored.
