---
name: ui-design
description: Visual design and UI text for nAIlbook's React client, covering the night backdrop and its decoration, the colour and font tokens, contrast, spacing, how components and states look, motion and how the Bulgarian UI text is written. Use when building or restyling a screen or component in client/, or when choosing a colour, font size, spacing or wording. Works together with ui-conventions, which covers structure and behaviour.
---

# UI design

`ui-conventions` says what each screen does and how it behaves. This skill says how it looks and how its text reads. If the two disagree, `ui-conventions` wins: report the conflict.

## Direction

nAIlbook is used in two ways. A client books a visit on a phone in a minute. A manicurist checks the day and edits the schedule between appointments.

The design is a night sky over the salon: a cherry-to-indigo backdrop with glitter, an aurora and a milky way, silver headings and iridescent cards like a fresh coat of polish. The light sheets carry the working screens (the manicurist's page, the forms, later the editors), so the work itself stays calm, light and exact: a porcelain surface, plum-ink text and one berry accent taken from nail polish. The whole app sparkles, not only the booking moment, but the sparkle lives in the backdrop and the decoration and never costs the text its contrast. There is no light version of the backdrop and no dark version of the sheets in the MVP.

## Tokens

The tokens are defined once, in the `@theme static` block of `client/src/index.css` below (`static`, so every token is emitted and a module can also read it with `var()`). The fonts are loaded by a `<link>` in `client/index.html`.

```css
@import "tailwindcss";

@theme static {
  --font-sans: "Montserrat", system-ui, sans-serif;
  --font-display: "Cormorant Garamond", Georgia, serif; /* h1–h3 and the logo */

  /* --- Light sheets --- */
  --color-surface: #FBF8F9;       /* sheet background */
  --color-raised: #FFFFFF;        /* cards, inputs, dialogs */
  --color-ink: #2B1E2C;           /* main text */
  --color-muted: #6E5F6C;         /* secondary text */
  --color-line: #E7DDE2;          /* dividers, card borders and the «Заето» fill, decorative only */
  --color-field: #8A7A87;         /* borders of inputs, selects, checkboxes, slot chips */
  --color-accent: #A3195B;        /* primary buttons, selected slot and date, links */
  --color-accent-strong: #82124A; /* hover and active state of accent */
  --color-accent-soft: #F6E3EC;   /* current day, selected row, badges */
  --color-danger: #B42318;        /* errors, destructive actions */
  --color-danger-soft: #FDECEA;   /* background of error boxes */
  --color-success: #1F7A4D;       /* confirmations */
  --color-white: #FFFFFF;         /* text on the night, sparks, strokes */

  /* --- Night backdrop --- */
  --color-night: #1E0B2E;         /* body background */
  --color-night-cherry: #4A0D35;  /* the backdrop gradient: top */
  --color-night-plum: #3A0F4A;    /* the backdrop gradient: middle */
  --color-night-indigo: #23104F;  /* the backdrop gradient: bottom */
  --color-veil: #100418;          /* header bar, start of the glass panel */
  --color-veil-deep: #0C0314;     /* footer bar */
  --color-shade: #0E0216;         /* shadows under text on the night */
  --color-shade-deep: #0A0112;    /* the widest silver shadow */
  --color-abyss: #0A0214;         /* the drop shadow under the glass panel */
  --color-panel-mid: #220A24;     /* the glass panel: middle */
  --color-panel-end: #340E28;     /* the glass panel: end */

  /* --- Glows --- */
  --color-glow-rose: #FF78BE;     /* backdrop, top right */
  --color-glow-indigo: #583CC8;   /* backdrop, left */
  --color-glow-pink: #FF96C8;     /* backdrop centre, panel and card glow */
  --color-glow-orchid: #F06EB4;   /* backdrop, bottom left */
  --color-glow-candy: #FF82C3;    /* panel and card halo */
  --color-aurora-pink: #FF96CD;   /* the aurora's first spot */
  --color-blossom: #FFAAD7;       /* the aurora's second spot, the panel's top light */
  --color-milky-gold: #FFDE96;    /* the milky way's glow */
  --color-milky-rose: #FFBED7;    /* the milky way's outer glow */
  --color-header-line: #FF8C9B;   /* the header's bottom border */
  --color-header-rim: #FFAAB4;    /* the light line under the header */
  --color-header-glow: #E24A60;   /* the header's near glow */
  --color-header-glow-deep: #C8344F; /* the header's far glow */
  --color-panel-border: #FFA0D2;  /* the glass panel's border */
  --color-panel-edge: #FFD2EB;    /* the glass panel's inner top edge */
  --color-panel-rim: #FFBEE1;     /* the light line under the glass panel */
  --color-star-halo: #FFE1F5;     /* halo of stars and of the badge */
  --color-lilac-halo: #DCBEFF;    /* outer halo of stars, flourishes and the badge */
  --color-flourish-halo: #FFEBF8; /* halo of the flourishes, inner light of the badge */
  --color-ornament-halo: #FFE6F5; /* halo of the footer ornament */
  --color-silver-glow: #F0E6FF;   /* the soft light around silver text */

  /* --- Text on the night --- */
  --color-moon: #FFF4FA;          /* copy text, footer text, the user's name */
  --color-blush: #FCE4F0;         /* the badge, links on the night */
  --color-silver: #E9ECF2;        /* silver headings: the fallback colour */
  --color-silver-1: #E4E7EE;      /* the six silver gradient stops (with white) */
  --color-silver-2: #EEF0F5;
  --color-silver-3: #D6DAE3;      /* the darkest stop */
  --color-silver-4: #F7F8FB;
  --color-silver-5: #DADDE6;
  --color-silver-6: #D9DCE5;

  /* --- Glitter sparks --- */
  --color-spark-gold: #FFE7A8;
  --color-spark-pink: #FFC3E4;
  --color-spark-lilac: #D8C8FF;
  --color-spark-rose: #FFD6EC;
  --color-spark-cream: #FFF1C9;
  --color-spark-lavender: #E9DDFF;
  --color-dust-cream: #FFF4D6;    /* the milky way's dust */
  --color-dust-gold: #FFE9B8;

  /* --- Iridescent card --- */
  --color-iri-1: #EDBFD7;
  --color-iri-2: #DECBF2;
  --color-iri-3: #C6B9EE;         /* the darkest stop */
  --color-iri-4: #F0D2C3;
  --color-iri-5: #F2E7CB;
  --color-iri-6: #CFC1EE;
  --color-card-ink: #24145A;      /* card text */
  --color-card-title: #3A0C4E;    /* the card's name */
  --color-card-muted: #4E4179;    /* city and durations */
  --color-plum: #5C1A72;          /* initials, the «Запази час» hover */
  --color-plum-bright: #6A2083;   /* top of the «Запази час» hover */
  --color-candy: #FF8CC6;         /* card borders, divider, the running light, sheet border */
  --color-pearl: #FFF6FB;         /* the avatar's and «Запази час»'s fill */
  --color-book-ink: #1C0A28;      /* «Запази час» text */
  --color-book-rim: #FFC8E6;      /* the inner light of «Запази час» on hover */
  --color-arrow-hover: #E2609F;   /* the carousel arrows on hover and focus, with a white icon */
  --color-dot: #F7C6DC;           /* the dots of the cards in view */

  /* --- Search on the night --- */
  --color-field-soft: #B9AAB2;    /* input borders on the glass panel, decorative */
  --color-input-ink: #231A20;     /* input text on the glass panel */

  /* --- Logo --- */
  --color-tag-1: #6E0A45;         /* the «AI» tag gradient, left to right */
  --color-tag-2: #A80F68;
  --color-tag-3: #E0309A;         /* also the polish drop */
  --color-tag-4: #FF86CF;
  --color-tag-5: #D81B8C;
  --color-tag-6: #9C0C60;
  --color-tag-7: #64083E;
  --color-tag-shade: #460028;     /* the tag's text and inner shadow */
  --color-tag-glow: #D63384;      /* the tag's glow */
  --color-sparkle: #FFDCF0;       /* the tag's glitter */
  --color-logo-drop: #14041E;     /* the bottle's shadow */
  --color-cap-1: #1E0618;         /* the bottle cap gradient */
  --color-cap-2: #4E123D;
  --color-cap-3: #2E0A25;
  --color-cap-4: #14030F;
  --color-polish-1: #8A0D55;      /* the polish gradient */
  --color-polish-2: #F04AAE;
  --color-polish-3: #FF9AD6;
  --color-polish-4: #B3106E;
  --color-polish-streak: #5A0032; /* the lines in the polish */
  --color-petal: #F2A7C8;         /* the bottle's collar */
  --color-neck: #F0DCE8;          /* the bottle's neck */

  /* --- Radii of the night components --- */
  --radius-control: 10px;         /* buttons and inputs on the night, «Запази час» */
  --radius-card: 16px;            /* the iridescent card */
  --radius-panel: 18px;           /* the glass search panel */
  --radius-map: 20px;             /* the studio map on the night */

  /* --- The shadow under copy text on the night --- */
  --text-shadow-copy:
    0 1px 1px color-mix(in srgb, var(--color-shade) 95%, transparent),
    0 2px 4px color-mix(in srgb, var(--color-shade) 90%, transparent),
    0 0 14px color-mix(in srgb, var(--color-shade) 80%, transparent),
    0 0 28px color-mix(in srgb, var(--color-shade) 55%, transparent);
}
```

**Contrast** (WCAG), checked by script against the lightest point of the backdrop (#7D5273 on desktop, #77507B on a phone, in its static frame):

- **On the night:** white 6.32, `moon` 5.89, `silver` 5.34, the darkest silver stop `silver-3` 4.51; white on the header veil 13.2, `moon` on the footer veil 12.5; `blush` on the badge 9.7 (7.2 on a phone); white labels on the glass panel 6.58; white on the glass buttons («Регистрация», «Изход», «Предишни») 5.25; white on `accent` 7.38; `card-title` on the pearl arrows 11+, white on `arrow-hover` 3.3 (an icon, 3:1); `input-ink` on white 16.9.
- **On the iridescent card**, against its darkest stop `iri-3`: `card-ink` 8.75, `card-title` 8.62, `card-muted` 4.91 (#4E4179, darker than the design's #574A85 for this reason); `plum` on `pearl` 11.4; `book-ink` on `pearl` 17.7; white on `plum-bright` / `plum` 9.8 / 11.4.
- **On the sheets:** `ink` on `surface` 15.0, `muted` on `surface` 5.7, `accent` on `surface` 7.0, white on `accent` 7.4, `accent` on `accent-soft` 6.0, `danger` on `danger-soft` 5.8, `success` on `surface` 5.0, `field` on `surface` 3.8 (control borders need 3:1).
- The «AI» of the logo is a logotype (the WCAG 1.4.3 exception). `field-soft` on white is decorative: the white field on the dark panel is the control's boundary. Text with the `copy` shadow passes 4.5:1 without the shadow.

Rules:

- Components use only these tokens (`bg-night`, `text-moon`, `border-candy`, `bg-surface`, `text-ink`...). Never a raw hex, an arbitrary colour (`text-[#...]`) or Tailwind's default palette (`pink-600`, `gray-700`).
- **A see-through colour is its token with alpha:** `bg-veil/55`, `border-white/60` in `@apply`; `color-mix(in srgb, var(--color-glow-rose) 50%, transparent)` inside a gradient, a shadow or a filter in plain CSS. Never a new token for a lighter copy of a colour.
- **Links on the night are `blush`** (white on hover), never `petal` (3.35:1 there); `petal` is only the bottle's collar in the logo.
- **The focus outline on the night is white** (`focus-visible:outline-white`): `accent` is below 3:1 against the backdrop and the glass panel. On the sheets and on the iridescent cards it stays `accent`.
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
- Plain CSS in a module is only for what `@apply` cannot say (a layered gradient, a shadow of several layers, a `filter`, a mask, a keyframe, a size from the home design such as 15px text), and it still uses the tokens through `var(--color-…)`, never a raw hex. The decoration's gradients, glitter and glows live in the modules of the components that draw them (`Backdrop`, `Logo`, `ManicuristCard`, `SearchForm`...).
- Inline SVG takes its colours from module classes (`fill`, `stroke`, `stop-color: var(--color-…)`), never from a hex in an attribute; `fill="none"` and `currentColor` are fine.
- `index.css` holds only the Tailwind import, `@theme static` (the colours, the font families, the radii and the `copy` text shadow) and the base style of `body` (`bg-night text-white`).

## Type

- Two families from Google Fonts, both with Cyrillic (served through `unicode-range`): **Montserrat** 400, 500, 600 and 700 for all text (`font-sans`, the default), and **Cormorant Garamond** 500, 600 and 700 for the h1–h3 titles and the logo (`font-display`). Cormorant has no 800: where the design asks for 800, use 700.
- They are loaded with one `<link>` in `client/index.html`, with `display=swap`. `index.html` sets `<html lang="bg">`.

| Use | Class |
|-----|-------|
| Meta text (address, duration) | `text-sm` (14px), never for body text |
| Body, inputs, buttons | `text-base` (16px, line-height 1.5) |
| Section titles on a sheet («Свободни часове», «Изберете услуга») | `font-display text-2xl font-bold text-ink` |
| Page title on a sheet | `font-display text-3xl font-bold text-ink` |
| Card title (the manicurist card) | `font-display font-bold`, 20px, line-height 1.2, with a 0.5px text stroke |
| Home section title («Маникюристи») | `font-display font-bold`, 26px, line-height 1.2, letter-spacing -0.01em, silver |
| Home page title only | `font-display font-bold`, `clamp(34px, 4.4vw, 52px)`, line-height 1.1, letter-spacing -0.01em, silver |
| Copy on the night | `font-medium text-moon` at 17px (the hero line), `text-base leading-tight font-medium text-moon` (the counter, 6px under the section title), with the `copy` shadow |

- **Silver text** (the h1 and h2 on `/`): `color: var(--color-silver)` is the fallback; the `silver-*` gradient with the white sparks, `background-clip: text` and a transparent fill only inside `@supports (background-clip: text) or (-webkit-background-clip: text)`; under `@media (forced-colors: active)` no gradient and `CanvasText`. It keeps the design's dark drop shadows.
- **Copy on the night** gets the `copy` text shadow (`text-shadow-copy`); it passes 4.5:1 without it.
- Times, dates and prices use `tabular-nums`, so columns of numbers line up.
- Long text (a bio) stays within `max-w-prose`.
- The one all-caps label is the home badge «Онлайн записване за маникюр». No other all-caps labels, no small label above every heading, no single coloured or italic word inside a headline.

## Layout and spacing

- **Scale.** The home design is the Claude Design artboard at about 75% for display sizes (the column, titles, paddings, radii, the decoration); body text stays 16px, small text at least 12px, and every control and link at least 44px tall.
- Mobile-first. **The 1120px centred column:** `main` is `max-w-280 mx-auto px-6` (24px side padding at every width; widened from 960px so that three cards with the arrows over them still fit «Ноктопластика» on one line). The header's and the footer's inner row spans the full window width with `px-6`: the logo on the far left, the menu (or the copyright) on the far right (decided after the user's look in the browser, 2026-10-30). The working screens sit in a light sheet in that column: the manicurist's page uses the full column, the auth forms (`/login`, `/register`) and later the manicurist editors a `max-w-xl` sheet, left-aligned. On `/` the glass search panel spans the whole column, and the results are a carousel (*Components*). Long text (a bio) stays within `max-w-prose`.
- Spacing follows Tailwind's scale, including the half steps the home design uses (`pt-2.5`, `py-1.5`, `p-4.5`), so `/` keeps the design's sizes at its scale. No arbitrary values such as `mt-[13px]`. `gap-2` inside a group of controls, `gap-4` between form fields, `gap-8` between sections of a sheet; on `/` `gap-10` between the hero and the results, and the hero `pt-12` with `gap-6`.
- Content is left-aligned. Only empty states are centred.

## Components

The radius depends on the role, not one radius for everything. On the sheets, surfaces are separated by borders, not shadows; only a dialog has `shadow-lg`. The night's own components (the header, the glass panel, the cards, the sheets) carry the design's glows.

| Element | Look |
|---------|------|
| Primary button | `bg-accent text-white hover:bg-accent-strong rounded-lg min-h-11 px-5 font-semibold`, with `border border-transparent` so it keeps its size when the disabled border appears. One per screen or form. |
| Secondary button | `bg-raised text-ink border border-field rounded-lg min-h-11 px-5` |
| Destructive button | `text-danger border border-danger rounded-lg min-h-11 px-5`; in a confirm dialog `bg-danger text-white` |
| Input, select | `bg-raised border border-field rounded-lg min-h-11 px-3`. A visible `<label>` above it in `font-semibold`; a placeholder is never the label. The field error goes below it in `text-sm text-danger`, and the input gets `aria-invalid` (border `danger`). **Required fields:** on a form that also has optional fields (such as `/register`), the label of every required field ends in ` *` inside `<span aria-hidden="true">`, and the input has `aria-required="true"`; a required radio group puts the `*` in its `<legend>`. An optional field has neither and no «(по желание)» in its label. Above the first field such a form has «Полетата със * са задължителни.» in `text-sm text-muted`. A form whose fields are all required (`/login`) has no `*` and no note. |
| Radio or checkbox group | a `<fieldset>` with a `<legend>` in `font-semibold`. Each option is a `<label>` row with `min-h-11`; the control is `size-5 accent-accent` with the focus outline. The group's error goes under the fieldset. |
| Text link | `inline-flex items-center min-h-11 text-accent hover:text-accent-strong hover:underline` with the focus outline. The menu links in the header add `font-semibold`. On the night a link is `text-blush hover:text-white` with the white focus outline (*Tokens*). |
| App header | a dark veil, `bg-veil/55`, with `border-b border-header-line/55` and a pink glow under it (three shadows: `header-rim`, `header-glow`, `header-glow-deep`). Its content is the full-width row (`w-full px-6`, `pt-5 pb-2.5`: room for the bottle on the logo), `flex-wrap justify-between gap-3`: the Logo and `<nav aria-label="Основно меню">`; below `sm` the menu takes its own line under the logo. A guest sees «Вход» (plain, `font-medium`) and «Регистрация», the glass outline button (`border-white/60` 1.5px, `bg-white/8`, `rounded-control`, `font-semibold`); a logged-in user sees their name (`text-moon font-semibold truncate`) and «Изход», the same glass outline button, `disabled` and saying «Излизане…» while logging out; while `/me` loads, «Зареждане…» in `moon`. Every control is at least 44px tall, with the white focus outline. |
| Logo | the n[AI]lbook logotype, a link to `/` named «nAIlbook — начало», bold `font-display`: «n» and «lbook» in white, «AI» on a nail-shaped tag (the `tag-*` gradient, glitter, a glow) with the polish bottle as inline SVG (`cap-*`, `polish-*`, `petal`, `neck`). Its gradient ids come from `useId`, because the page shows the logo twice. 24px in the header, 18px in the footer, at least 44px tall. |
| Footer | an ornament row above it (three stars, a flourish, three stars, `aria-hidden`), then a bar `bg-veil-deep/55 border-t border-white/10 text-moon` holding the full-width row (`w-full px-6 pt-6 pb-5`): the Logo (18px) on the far left and «© 2026 Анина Ангелова. Всички права запазени.» on the far right (15px, `font-medium`, the `copy` shadow). |
| Sheet | the light surface of a working screen on the night: `bg-surface rounded-2xl border border-candy p-3 sm:p-8` with a soft pink glow (`glow-candy`, `glow-pink`), text `ink`, `mt-8 sm:mt-12` under the header. `p-3` on a phone keeps the week table's five day columns at 44px inside the page padding. Inside it the light tokens and components apply as everywhere on the sheets. `narrow` makes it `max-w-xl`. |
| Glass search panel | the `SearchForm` on `/`, the full column wide: `rounded-panel border border-panel-border/60 p-4.5` (18px, radius 18px), a dark glass (`veil` → `panel-mid` → `panel-end`) with pink light from two corners (`glow-pink`, `blossom`) and six shadows (the inner edge `panel-edge`, an inner `glow-pink`, the rim `panel-rim`, `glow-candy`, `glow-pink`, `abyss`). The fields are `flex: 1 1 260px` (side by side while they fit, one per line on a phone), with 15px white `font-semibold` labels with the `copy` shadow and white 44px inputs (`min-h-11 rounded-control border-field-soft px-4 text-input-ink`) holding an example placeholder («напр. София», «напр. Гел лак») in `muted`; «Търсене» is `bg-accent`, 44px, `px-8`, `text-base font-semibold`, `rounded-control` (Button `variant="search"`); below `lg` it takes its own line under the fields, the full width (`basis-full`), 12px lower (`mt-3`), as in the design. White focus outlines. |
| Badge | the one all-caps label, on `/` above the h1: `rounded-full border border-white/60 bg-white/10 px-3 py-1.5`, 13px `font-semibold uppercase` with letter-spacing 0.08em, `text-blush`, with a star-like halo (white, `star-halo`, `lilac-halo`, an inner `flourish-halo`). |
| Carousel | the search results on `/` (`ManicuristCarousel`). A head row: the section title with the counter 6px under it on the left (`role="status"`, `min-h-5 leading-tight`, `text-moon font-medium`, the `copy` shadow), and the counter reads «Показани 1–3 от 6», or «Показана 1 от 6» with one card in view. Then the Swiper (`spaceBetween` 12), with 20px of padding inside it and `-20px` side margins, so the lift and the glow are not cut and the cards line up with the column. **The arrows sit on the outer edges of the first and the last card in view** (the design puts them 12px inside the cards with extra card padding; moved after the user's look, because that padding made «Ноктопластика» wrap and narrowed «Запази час»): «Предишни» and «Следващи» are 44px circles, vertically centred, `-left-6` and `-right-6` (24px outside the card, 20px over its padding, never over its content), in the DOM before the Swiper (so Tab reaches them first): the `pearl` gradient, `border-candy`, a `card-title` chevron (20px, stroke 2.4), the pearl shadows, `opacity-72` at rest; on hover and focus `opacity-100`, `bg-arrow-hover` with a white chevron and a white border, a candy glow, and they grow a little in place (`scale: 1.08`, no shift) when motion is allowed. Every card keeps the same padding and full width. At 375px an arrow reaches the screen edge, so the page box (`Layout`) has `overflow-x-clip`: a growing arrow or a glow never adds a sideways scroll. Then the dots, `aria-hidden`: one per card, 8px, `bg-white/30`, the cards in view `bg-dot`, the first in view 24px wide. |
| Manicurist card | the iridescent search result in the carousel: a 3px transparent border, `rounded-card p-4.5 gap-3` (16px radius, 18px padding), the `iri-*` gradient in its first frame, an inner white light and a pink glow, text `card-ink`. At the top the initials avatar (a 40px circle, the `pearl` gradient, `border-candy`, `text-plum` bold 15px, `aria-hidden`) beside the name (h3, see *Type*, `text-card-title` with a white-and-pink text shadow) and the city with a pin icon (`text-card-muted`). Then a divider: a white star with a `candy` stroke between two `candy` lines that fade out (`aria-hidden`). Then at most the first 3 active services (in the API's order) as rows of a `minmax(0, 1fr) auto` grid with `gap-x-3 items-baseline`, as in the design: the name on the left, the price and the duration together on the right of the same line; a long name wraps between its words, and a word too long for the column is hyphenated (`hyphens-auto`, the page is `lang="bg"`), at `text-sm` (14px, the one place where list text is smaller than 16px, so the names fit the 290px card), 8px apart: the name, the `Price` (`font-medium`) and «60 мин» (`text-sm text-card-muted`); with more, one line «и още N услуги» («и още 1 услуга» for one) in `text-sm text-card-muted`. The manicurist's page lists every service. Last «Запази час», at the bottom of the card (the slides are equally tall): `rounded-control border border-candy`, the `pearl` gradient, `text-book-ink font-bold`, at least 44px; on hover and focus it fills with `plum-bright` → `plum`, white text and a `candy` ring. On hover and keyboard focus (`:has(:focus-visible)`, not `:focus-within`: after a mouse click only the active look stays, decided 2026-10-31) the card gets a brighter glow and a `candy` ring, and a 4px lift when motion is allowed. The active card (`activeId`: the first at the start, then the one the user clicked or whose marker was chosen) stays lifted by 4px, and a light (`candy` to white) runs round its border. The name is a stretched button that looks exactly like the heading text (no button fill, border or underline); its keyboard focus shows as the card's `:has(:focus-visible)` look. |
| Studio map | on `/`, the section «Студиа на картата» under the carousel, as in the design: the h2 in the silver style of «Маникюристи» with the line «Вижте къде е всяко студио.» 6px under it (`text-moon font-medium`, the `copy` shadow; the design's «…най-близо до вас» is not used, because the app does not know where the user is), then the map 20px below: 460px high (300px below `sm`), `rounded-map overflow-hidden`, `border border-white/25`, the shadow `0 20px 50px` in `shade` at 40%, `isolation: isolate`. Only the OpenStreetMap credit, with no Leaflet link before it (`setPrefix(false)`). On `/manicurists/:id` the map sits under «град, адрес» on the light sheet, its one marker in the active look: 240px high (200px below `sm`), `rounded-card overflow-hidden border border-line`. Leaflet's zoom buttons and attribution keep Leaflet's own light look, but the zoom buttons are 44×44px (`:global(.leaflet-bar a)` in the map's module, line-height 44px) and get the focus outline; the attribution stays visible. |
| Map marker | an `L.divIcon` with a 44×44px target and the dot centred in it, as in the design. **Normal:** a 22px circle, `bg-accent`, a 4px white border, the shadow `0 4px 10px` in `accent-strong` at 30%. **Highlighted** (hover or focus on its card, hover or focus on the marker): 26px, plus a 3px `candy` ring. **Active:** 32px, `bg-plum`, the white four-point star of the card divider (12px) in the middle, a 3px `candy` ring and a soft `glow-candy` halo, on top of the others (`zIndexOffset`). Size changes use `transition-transform` 150ms only when motion is allowed; no infinite animation. Contrast: `accent` and `plum` on the map's light tiles are both above 3:1 for a non-text graphic, and the white border keeps the dot visible on dark tiles. |
| Week table | a pink board like a school timetable: a box `bg-accent-soft rounded-xl p-2 sm:p-4` with no border (the colour sets it apart), holding the week navigation and a real `<table>`. **The week navigation** is its own white bar, `bg-raised rounded-lg`, followed by one `text-muted` line (`min-h-6`, the `role="status"`): «Зареждане…» while a week loads, otherwise the empty-week message or «Маникюристът не е добавил услуги.», or nothing; then the table, with only the board's `gap-2` between them, so the board stays compact: the title («26 октомври – 1 ноември 2026 г.», `text-lg font-semibold text-ink`) between «Предишна седмица» and «Следваща седмица», quiet icon buttons with inline SVG chevrons, at least 44×44px, no tile of their own, `hover:bg-accent-soft` and the focus outline. **The table** has `border-separate border-spacing-x-0.5 border-spacing-y-1 sm:border-spacing-x-2` (the 2px column gap below `sm` keeps six day columns at 44px at 375px; rows are 4px apart at every width, so the board stays compact) and uses the available width, the day columns stretching evenly (`table-fixed`, a 44px time column), with a visually hidden `<caption>` with the week range. **The day headers** (`<th scope="col">`) are no tiles, so they never look like the times: centred text on the pink board, the short weekday in `font-semibold text-ink` above day.month («пн» / «2.11») in `text-sm text-muted`, with a short `border-b-2 border-accent` underline under each (the label has no side padding below `sm`, and day.month `tracking-tight` there, so «30.10» in Montserrat stays inside its column), and the full date for screen readers. **Every other cell is a white tile** `bg-raised rounded-lg`, at least 44px tall, with pink gaps between them: the times (`<th scope="row">` with HH:mm, `text-sm text-ink tabular-nums`) and the «—» cells (`text-muted`, with the visually hidden text «няма свободен час»); the empty corner has no tile. Every row is one 44px tile high, also a row added for an off-grid time such as 12:10, so a block shows its length by its rows and its times. **A busy interval** is one tile over its rows (`rowSpan`), `rounded-lg bg-line text-ink` (`line` as a fill only here: the word carries the meaning, not the colour), with «Заето» in `text-sm font-semibold` and its times «11:30–12:10» below it in `text-xs tabular-nums`, visible from `sm` up and visually hidden below `sm`, so a screen reader always reads «Заето 11:30–12:10»; no names and no service. A free time is a `<button aria-pressed>` named «<full date>, HH:mm» that fills its tile: `rounded-lg border border-accent bg-raised text-accent font-semibold`, hover `bg-accent-soft`, selected `bg-accent text-white`, at least 44×44px, with HH:mm visible from `sm` up and no visible text below `sm`. A day off is one tall white tile «Почивен ден» over all rows (`text-sm text-muted`, the words run top to bottom below `sm`). Contrast: `ink` on white 15.9, on `accent-soft` 12.9 and on `line` 12.0, `muted` on white 6.0 and on `accent-soft` 4.9, `accent` on white 7.4 and on `accent-soft` 6.0, white on `accent` 7.4. Five working days fit at 375px with 44px buttons. |
| Disabled week button, slot or button | the `disabled` attribute, `text-muted bg-surface border-line cursor-not-allowed`. Not only `opacity-50`. |
| Price | `tabular-nums`; the euros and ` €` in the surrounding size, the cents with their comma (`,00`) in `text-xs` with `align-super`: 25<sup>,00</sup> €. The text stays «25,00 €» for screen readers. |
| Bookings, schedule, days off, services | rows in one container with `divide-y divide-line`, not a card per row |
| Status badge | `rounded-full px-2 text-sm`; upcoming `bg-accent-soft text-accent-strong`, cancelled `text-muted` |

- Every clickable element is at least 44px tall (`min-h-11`), with at least 8px between neighbours.
- Focus on every interactive element: `focus-visible:outline-2 focus-visible:outline-offset-2`, with `focus-visible:outline-accent` on the sheets and the cards and `focus-visible:outline-white` on the night (*Tokens*).
- Icons are inline SVG, 20px on a control, with `aria-hidden="true"`. No emoji as icons and no icon library.
- **Decoration is hidden from screen readers** (`aria-hidden="true"`) and from the pointer: the backdrop, the ornament row, the card's avatar, divider and dots.
- **The backdrop's line art steps back on smaller screens**, as in the design: the four flourishes are `opacity-70`, `opacity-40` below `lg`, and below `sm` the flourishes and the column of stars are hidden, so they never sit under the text. The glitter, the aurora, the milky way and the corner rays stay at every width.

## States

Every screen that loads data has four states:

- **Loading:** «Зареждане…» or placeholder rows of the same height, so the layout does not jump. A button during its request is `disabled` and shows the action in progress: «Запазване…». The one exception is a search form: its button stays enabled while results load, so a new search can start (the previous request is aborted, `ui-conventions`, *Loading data*), and the previous results stay on screen with `aria-busy` while a fixed-height line says «Зареждане…»: on `/` the carousel's counter line, or the status line under «Маникюристи» when no result is on screen.
- **Empty:** says what is missing and offers the next step.
- **Error:** the server's message in a box with `bg-danger-soft text-danger rounded-lg p-3` above the form, on a sheet and on the night alike. Field errors go under their fields.
- **Success:** a short confirmation in `text-success` next to the action, named after the action.

## Motion

- Motion only answers an action: a dialog opens, a slot is selected, a confirmation appears, the carousel moves. Use `transition-colors` or `transition-opacity` for 150–200ms; the manicurist card's lift moves `transform` for 250ms. Never animate width or height (the active dot changes its width without a transition).
- **At most three infinite animations, all of them decoration:** the glitter's twinkle, the stars' twinkle and the light running round the active card's border (`@property --spin`). Everything else is shown in its static best frame, never removed: the aurora (still, because moving it puts its bright spot under text, 2.1–2.5:1), the silver sheen, the iridescent sheen, the milky way's dust (opacity 0.55) and the active card's breathing (it stays lifted by 4px).
- No entrance animations when a page loads, and no lift or zoom on hover, except the manicurist card (*Components*), which lifts by 4px.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no animation and no transition at all, and no hover lift. In CSS every animation and transition sits under `@media (prefers-reduced-motion: no-preference)` or `motion-safe:`. Code that moves things reads `useReducedMotion()`: the carousel gets `speed: 0`, a scroll uses `behavior: 'auto'`.

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
