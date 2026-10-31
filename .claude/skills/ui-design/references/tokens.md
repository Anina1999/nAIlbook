# ui-design: tokens, type and spacing

Part of the `ui-design` skill ([SKILL.md](../SKILL.md)). The rules for using the tokens are in SKILL.md, *Tokens*.

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
  --color-map-ground: #F2EFE9;    /* the land colour of the OSM tiles, under them while they load */
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
