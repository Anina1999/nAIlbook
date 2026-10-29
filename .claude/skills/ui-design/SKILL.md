---
name: ui-design
description: Visual design and UI text for nAIlbook's React client, covering the colour and font tokens, spacing, how components and states look, motion and how the Bulgarian UI text is written. Use when building or restyling a screen or component in client/, or when choosing a colour, font size, spacing or wording. Works together with ui-conventions, which covers structure and behaviour.
---

# UI design

`ui-conventions` says what each screen does and how it behaves. This skill says how it looks and how its text reads. If the two disagree, `ui-conventions` wins: report the conflict.

## Direction

nAIlbook is used in two ways. A client books a visit on a phone in a minute. A manicurist checks the day and edits the schedule between appointments. The design is calm, light and exact, like a clean salon table: a porcelain background, plum-ink text and one berry accent taken from nail polish.

Spend the boldness in one place: the booking moment, which is the slot picker and the Book button. Everything else stays quiet. There is no dark mode in the MVP.

## Tokens

The tokens are defined once, in the `@theme` block of `client/src/index.css` below. The font is loaded by a `<link>` in `client/index.html`.

```css
@import "tailwindcss";

@theme {
  --font-sans: "Sofia Sans", system-ui, sans-serif;

  --color-surface: #FBF8F9;       /* page background */
  --color-raised: #FFFFFF;        /* cards, inputs, dialogs */
  --color-ink: #2B1E2C;           /* main text */
  --color-muted: #6E5F6C;         /* secondary text */
  --color-line: #E7DDE2;          /* dividers and card borders, decorative only */
  --color-field: #8A7A87;         /* borders of inputs, selects, checkboxes, slot chips */
  --color-accent: #A3195B;        /* primary buttons, selected slot and date, links */
  --color-accent-strong: #82124A; /* hover and active state of accent */
  --color-accent-soft: #F6E3EC;   /* current day, selected row, badges */
  --color-danger: #B42318;        /* errors, destructive actions */
  --color-danger-soft: #FDECEA;   /* background of error boxes */
  --color-success: #1F7A4D;       /* confirmations */
}
```

Checked contrast (WCAG): `ink` on `surface` 15.0, `muted` on `surface` 5.7, `accent` on `surface` 7.0, white on `accent` 7.4, `accent` on `accent-soft` 6.0, `danger` on `danger-soft` 5.8, `success` on `surface` 5.0, `field` on `surface` 3.8 (control borders need 3:1), and on a hovered search result `ink` on `accent-soft` 12.9, `muted` on `accent-soft` 4.9, `accent-strong` on `accent-soft` 8.0.

- Components use only these tokens (`bg-surface`, `text-ink`, `border-field`, `bg-accent`...). Never a raw hex, an arbitrary colour (`text-[#...]`) or Tailwind's default palette (`pink-600`, `gray-700`).
- `danger` is only for errors and destructive actions (cancel a booking, remove a day off). `accent` never marks an error.
- Colour never carries meaning alone. A status also has a word: «Отказан», «Предстоящ».
- A new token is added here first, with its contrast checked.

## Where styles live

Every component and page has its own CSS Module (`ui-conventions`, *Structure*). The Tailwind classes in this skill are written there with `@apply`, not in the JSX.

```css
/* components/button/Button.module.css */
@reference "../../index.css";

.primary {
  @apply bg-accent text-white hover:bg-accent-strong rounded-lg min-h-11 px-5 font-semibold;
  @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent;
}
```

- Each module starts with `@reference` to `client/src/index.css` (the path is relative to the module), so `@apply` knows the tokens. `@reference` adds no CSS of its own.
- The JSX sets only `className={styles.primary}`. No utility classes in JSX. Join several module classes with `[styles.a, cond && styles.b].filter(Boolean).join(' ')`.
- Class names are camelCase and name the role (`.primary`, `.fieldError`, `.column`), not the look (`.pinkBox`).
- Plain CSS in a module is only for what `@apply` cannot say, and it still uses the tokens (`var(--color-line)`), never a raw hex.
- `index.css` holds only the Tailwind import, `@theme` and the base style of `body` (`bg-surface text-ink`).

## Type

- One family: **Sofia Sans**, weights 400, 600 and 700. It is made by a Bulgarian foundry and draws the Bulgarian Cyrillic letter forms when the page has `<html lang="bg">`, which `index.html` already sets.
- It is loaded from Google Fonts with a `<link>` in `client/index.html`, with `display=swap` and the `cyrillic` and `latin` subsets.

| Use | Class |
|-----|-------|
| Meta text (address, duration) | `text-sm` (14px), never for body text |
| Body, inputs, buttons | `text-base` (16px, line-height 1.5) |
| Card and section titles | `text-lg font-semibold` |
| Page title | `text-2xl font-bold` |
| Home page title only | `text-3xl font-bold` |

- Times, dates and prices use `tabular-nums`, so columns of numbers line up.
- Long text (a bio) stays within `max-w-prose`.
- No all-caps labels, no small label above every heading, no single coloured or italic word inside a headline.

## Layout and spacing

- Mobile-first. The page column is the full window width with side padding: `w-full px-4 sm:px-6 lg:px-8`, with no `max-w-*` of its own. The manicurist editors and the auth forms (`/login`, `/register`) use `max-w-xl`, left-aligned. The search form on `/` (its inputs and the button) is capped at `max-w-3xl`, left-aligned, while the results stay full width. Long text (a bio) stays within `max-w-prose`. Lists of cards are a responsive grid: the search results have 1 column, 2 from `md`, 3 from `xl` and 4 from `2xl`.
- Spacing follows Tailwind's 4px scale: `gap-2` inside a group of controls, `gap-4` between form fields, `gap-8` between sections. No arbitrary values such as `mt-[13px]`.
- Content is left-aligned. Only empty states are centred.

## Components

The radius depends on the role, not one radius for everything. Surfaces are separated by borders, not shadows; only a dialog has `shadow-lg`, and a search result card gets `shadow-md` on hover and focus.

| Element | Look |
|---------|------|
| Primary button | `bg-accent text-white hover:bg-accent-strong rounded-lg min-h-11 px-5 font-semibold`, with `border border-transparent` so it keeps its size when the disabled border appears. One per screen or form. |
| Secondary button | `bg-raised text-ink border border-field rounded-lg min-h-11 px-5` |
| Destructive button | `text-danger border border-danger rounded-lg min-h-11 px-5`; in a confirm dialog `bg-danger text-white` |
| Input, select | `bg-raised border border-field rounded-lg min-h-11 px-3`. A visible `<label>` above it in `font-semibold`; a placeholder is never the label. The field error goes below it in `text-sm text-danger`, and the input gets `aria-invalid` (border `danger`). **Required fields:** on a form that also has optional fields (such as `/register`), the label of every required field ends in ` *` inside `<span aria-hidden="true">`, and the input has `aria-required="true"`; a required radio group puts the `*` in its `<legend>`. An optional field has neither and no «(по желание)» in its label. Above the first field such a form has «Полетата със * са задължителни.» in `text-sm text-muted`. A form whose fields are all required (`/login`) has no `*` and no note. |
| Radio or checkbox group | a `<fieldset>` with a `<legend>` in `font-semibold`. Each option is a `<label>` row with `min-h-11`; the control is `size-5 accent-accent` with the focus outline. The group's error goes under the fieldset. |
| Text link | `inline-flex items-center min-h-11 text-accent hover:text-accent-strong hover:underline` with the focus outline. The menu links in the header add `font-semibold`. |
| App header | a bar with `border-b border-line` on `surface`. Its content follows the page column (`w-full px-4 sm:px-6 lg:px-8`), so the logo and the menu line up with the content, and may wrap at narrow widths: the logo link (`text-lg font-bold text-ink`, not a heading) and the menu. A long user name is cut with `truncate`. |
| Week table | a pink board like a school timetable: a box `bg-accent-soft rounded-xl p-2 sm:p-4` with no border (the colour sets it apart), holding the week navigation and a real `<table>`. **The week navigation** is its own white bar, `bg-raised rounded-lg`, with a clear gap before the table (`mb-4 sm:mb-6`): the title («26 октомври – 1 ноември 2026 г.», `text-lg font-semibold text-ink`) between «Предишна седмица» and «Следваща седмица», quiet icon buttons with inline SVG chevrons, at least 44×44px, no tile of their own, `hover:bg-accent-soft` and the focus outline. **The table** has `border-separate border-spacing-x-0.5 border-spacing-y-1 sm:border-spacing-2` (the 2px column gap below `sm` keeps six day columns at 44px at 375px) and uses the available width, the day columns stretching evenly (`table-fixed`, a 44px time column), with a visually hidden `<caption>` with the week range. **The day headers** (`<th scope="col">`) are no tiles, so they never look like the times: centred text on the pink board, the short weekday in `font-semibold text-ink` above day.month («пн» / «2.11») in `text-sm text-muted`, with a short `border-b-2 border-accent` underline under each, and the full date for screen readers. **Every other cell is a white tile** `bg-raised rounded-lg`, at least 44px tall, with pink gaps between them: the times (`<th scope="row">` with HH:mm, `text-sm text-ink tabular-nums`) and the «—» cells (`text-muted`, with the visually hidden text «няма свободен час»); the empty corner has no tile. A free time is a `<button aria-pressed>` named «<full date>, HH:mm» that fills its tile: `rounded-lg border border-accent bg-raised text-accent font-semibold`, hover `bg-accent-soft`, selected `bg-accent text-white`, at least 44×44px, with HH:mm visible from `sm` up and no visible text below `sm`. A day off is one tall white tile «Почивен ден» over all rows (`text-sm text-muted`, the words run top to bottom below `sm`). Contrast: `ink` on white 15.9 and on `accent-soft` 12.9, `muted` on white 6.0 and on `accent-soft` 4.9, `accent` on white 7.4 and on `accent-soft` 6.0, white on `accent` 7.4. Five working days fit at 375px with 44px buttons. |
| Disabled week button, slot or button | the `disabled` attribute, `text-muted bg-surface border-line cursor-not-allowed`. Not only `opacity-50`. |
| Search result | a card: `bg-raised border border-line rounded-xl p-4`, no shadow at rest. The whole card is a link (`ui-conventions`). On hover, and when its link has keyboard focus (`:focus-within`): `border-accent bg-accent-soft shadow-md` and `motion-safe:-translate-y-1`, with `transition` for 200ms, and the name turns `text-accent-strong` with no underline (the card's name link is the one link without `hover:underline`); with reduced motion only the border and the shadow change. The list or carousel leaves room around the cards, so the lift and the shadow are not cut. In the results carousel (with the map) the active card stays marked without hover: `border-accent ring-2 ring-accent`. |
| Price | `tabular-nums`; the euros and ` €` in the surrounding size, the cents with their comma (`,00`) in `text-xs` with `align-super`: 25<sup>,00</sup> €. The text stays «25,00 €» for screen readers. |
| Bookings, schedule, days off, services | rows in one container with `divide-y divide-line`, not a card per row |
| Status badge | `rounded-full px-2 text-sm`; upcoming `bg-accent-soft text-accent-strong`, cancelled `text-muted` |

- Every clickable element is at least 44px tall (`min-h-11`), with at least 8px between neighbours.
- Focus on every interactive element: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`.
- Icons are inline SVG, 20px, with `aria-hidden="true"`. No emoji as icons and no icon library.

## States

Every screen that loads data has four states:

- **Loading:** «Зареждане…» or placeholder rows of the same height, so the layout does not jump. A button during its request is `disabled` and shows the action in progress: «Запазване…». The one exception is a search form: its button stays enabled while results load, so a new search can start (the previous request is aborted, `ui-conventions`, *Loading data*), and the previous results stay on screen with `aria-busy` under a fixed-height «Зареждане…» line.
- **Empty:** says what is missing and offers the next step.
- **Error:** the server's message in a box with `bg-danger-soft text-danger rounded-lg p-3` above the form. Field errors go under their fields.
- **Success:** a short confirmation in `text-success` next to the action, named after the action.

## Motion

- Motion only answers an action: a dialog opens, a slot is selected, a confirmation appears. Use `transition-colors` or `transition-opacity` for 150–200ms. Never animate width or height.
- Put it behind `motion-safe:`. No entrance animations when a page loads, and no lift or zoom on hover, except the search result card (*Components*), which lifts by 4px.

## Writing UI text

All UI text is in Bulgarian, in the polite plural form («Изберете», «Намерете»).

- **Name things as the user knows them:** «Моите часове», «Работно време», «Почивни дни», «Свободни часове». Not system words like «слот» or «резервация №».
- **A button says what happens:** «Запази час», «Запази промените», «Добави услуга». Never «Изпрати», «ОК» or «Потвърди» on their own.
- **An action keeps its name through the flow:** «Запази час» → «Часът е запазен.» «Откажи часа» → the dialog asks «Да откажем ли часа в 14:30?» with «Откажи часа» and «Назад» → «Часът е отказан.»
- **Errors the client writes** say what happened and how to fix it, without apologies: «Изберете час, за да продължите.» Server messages are shown as they come.
- **Empty states invite an action:** «Още нямате запазени часове.» with a link «Намерете маникюрист».
- Sentence case, no filler, no exclamation marks, no emoji. Each piece of text does one job.

## Avoid

These are the usual defaults of generated UI, not choices for nAIlbook:

- the same rounded card with the same soft shadow around every piece of content;
- gradients as decoration;
- all-caps labels, «→» added to buttons and links, meta joined with dots («А · Б · В»);
- fade-in and slide-up on every section;
- Tailwind's default pink and grey instead of the tokens.

## Before you report done

- Only tokens: no raw hex, no arbitrary colours, no default palette classes.
- Styles are in the component's or page's `.module.css`, with no utility classes in the JSX.
- Every interactive element is at least 44px tall and has a visible focus.
- Loading, empty and error states are there.
- The screen works at 375px without horizontal scroll.
- The text follows the writing rules.
