---
name: ui-design
description: Visual design and UI text for nAIlbook's React client, covering the night backdrop and its decoration, the colour and font tokens, contrast, spacing, how components and states look, motion and how the Bulgarian UI text is written. Use when building or restyling a screen or component in client/, or when choosing a colour, font size, spacing or wording. Works together with ui-conventions, which covers structure and behaviour.
---

# UI design

`ui-conventions` says what each screen does and how it behaves. This skill says how it looks and how its text reads. If the two disagree, `ui-conventions` wins: report the conflict.

## Reference files

The rules in this file hold for every task. Read a reference file only when the task needs it:

| File | Read it when |
|------|--------------|
| [references/tokens.md](references/tokens.md): *Tokens* (`@theme`, contrast), *Type*, *Layout and spacing* | choosing a colour, font size, spacing or width; checking contrast |
| [references/components.md](references/components.md): *Components*, one row per element | building or restyling an element (button, input, header, card, carousel, map, week table…) |
| [references/motion.md](references/motion.md): *Motion* | adding a transition or an animation |
| [references/writing.md](references/writing.md): *Writing UI text* | writing UI text |

## Direction

nAIlbook is used in two ways. A client books a visit on a phone in a minute. A manicurist checks the day and edits the schedule between appointments.

The design is a night sky over the salon: a cherry-to-indigo backdrop with glitter, an aurora and a milky way, silver headings and iridescent cards like a fresh coat of polish. The light sheets carry the working screens (the manicurist's page, the forms, later the editors), so the work itself stays calm, light and exact: a porcelain surface, plum-ink text and one berry accent taken from nail polish. The whole app sparkles, not only the booking moment, but the sparkle lives in the backdrop and the decoration and never costs the text its contrast. There is no light version of the backdrop and no dark version of the sheets in the MVP.

## Tokens

The `@theme static` block of `client/src/index.css` and the contrast figures are in [references/tokens.md](references/tokens.md).

Rules:

- Components use only these tokens (`bg-night`, `text-moon`, `border-candy`, `bg-surface`, `text-ink`...). Never a raw hex, an arbitrary colour (`text-[#...]`) or Tailwind's default palette (`pink-600`, `gray-700`).
- **A see-through colour is its token with alpha:** `bg-veil/55`, `border-white/60` in `@apply`; `color-mix(in srgb, var(--color-glow-rose) 50%, transparent)` inside a gradient, a shadow or a filter in plain CSS. Never a new token for a lighter copy of a colour.
- **Links on the night are `blush`** (white on hover), never `petal` (3.35:1 there); `petal` is only the bottle's collar in the logo.
- **The focus outline on the night is white** (`focus-visible:outline-white`): `accent` is below 3:1 against the backdrop and the glass panel. On the sheets and on the iridescent cards it stays `accent`.
- `danger` is only for errors and destructive actions (cancel a booking, remove a day off). `accent` never marks an error.
- Colour never carries meaning alone. A status also has a word: «Отменен», «Предстоящ».
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
- Plain CSS in a module is only for what `@apply` cannot say (a layered gradient, a shadow of several layers, a `filter`, a mask, a keyframe), and it still uses the tokens through `var(--color-…)`, never a raw hex.
- **A font size is always a `text-*` token** (`references/tokens.md`, *Type*), never a `font-size` in px in a module. A size the Tailwind scale does not have gets a named token in `index.css` (`text-hero-title`, `text-label`), so one ratio changes every text at once. Only sizes relative to their own text (`em`, the «AI» tag of the logo) stay in the module. The decoration's gradients, glitter and glows live in the modules of the components that draw them (`Backdrop`, `Logo`, `ManicuristCard`, `SearchForm`...).
- Inline SVG takes its colours from module classes (`fill`, `stroke`, `stop-color: var(--color-…)`), never from a hex in an attribute; `fill="none"` and `currentColor` are fine.
- `index.css` holds only the Tailwind import, `@theme static` (the colours, the font families, the type scale: `--type-scale` and the `--text-*` sizes, the radii and the `copy` text shadow) and the base style of `body` (`bg-night text-base text-white`, so text without a size class follows the type scale).

## Components

The radius depends on the role, not one radius for everything. On the sheets, surfaces are separated by borders, not shadows; only a dialog has `shadow-lg`. The night's own components (the header, the glass panel, the cards, the sheets) carry the design's glows.

The look of each element is in [references/components.md](references/components.md).

- Every clickable element is at least 44px tall (`min-h-11`), with at least 8px between neighbours.
- Focus on every interactive element: `focus-visible:outline-2 focus-visible:outline-offset-2`, with `focus-visible:outline-accent` on the sheets and the cards and `focus-visible:outline-white` on the night (*Tokens*).
- Icons are inline SVG, 20px on a control, with `aria-hidden="true"`. No emoji as icons and no icon library.
- **Decoration is hidden from screen readers** (`aria-hidden="true"`) and from the pointer: the backdrop, the ornament row, the card's avatar, divider and dots.
- **The backdrop's line art steps back on smaller screens**, as in the design: the four flourishes are `opacity-70`, `opacity-40` below `lg`, and below `sm` the flourishes and the column of stars are hidden, so they never sit under the text. The glitter, the aurora, the milky way and the corner rays stay at every width.

## States

Every screen that loads data has four states:

- **Loading:** «Зареждане…» or placeholder rows of the same height, so the layout does not jump. A button during its request is `disabled` and shows the action in progress: «Запазване…». The one exception is a search form: its button stays enabled while results load, so a new search can start (the previous request is aborted, `ui-conventions`, *Loading data*), and the previous results stay on screen with `aria-busy` while a fixed-height line says «Зареждане…»: on `/` the carousel's counter line, or the status line under «Маникюристи» when no result is on screen.
- **Empty:** says what is missing and offers the next step.
- **Error:** the server's message in a box with `bg-danger-soft text-danger rounded-lg p-3` above the form, on a sheet and on the night alike. Field errors go under their fields. **No connection** (`ConnectionError`, `ui-conventions`): no sheet and no box, the message in `text-lg font-medium text-moon` with the `copy` shadow and «Зареди отново» (the night's primary button, `search`) under it, centred across and down the free height of `main`.
- **Success:** a short confirmation in `text-success` next to the action, named after the action.

## Avoid

These are the usual defaults of generated UI, not choices for nAIlbook:

- the same rounded card with the same soft shadow around every piece of content;
- all-caps labels (the home badge is the one exception), «→» added to buttons and links, meta joined with dots («А · Б · В»);
- fade-in and slide-up on every section;
- Tailwind's default pink and grey instead of the tokens.

## Before you report done

- Only tokens: no raw hex, no arbitrary colours, no default palette classes; a see-through colour is its token with alpha.
- Styles are in the component's or page's `.module.css`, with no utility classes in the JSX.
- Every interactive element is at least 44px tall and has a visible focus (white on the night).
- Loading, empty and error states are there.
- The screen works at 375px without horizontal scroll.
- Decoration is `aria-hidden`, and nothing moves under reduced motion.
- The text follows the writing rules.
