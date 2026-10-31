---
name: best-code-practices
description: React and TypeScript practices for nAIlbook's client, with the reasons behind them, covering folders by kind of code, components with CSS Modules, effects only for syncing and kept in hooks, data loading with AbortController, controlled forms, contexts, the URL as state, clickable cards, the Swiper carousel and imperative widgets such as Leaflet. Use when writing, reviewing or refactoring any code in client/. Works together with ui-conventions (the exact paths, screens and UI rules) and ui-design (the look).
---

# Best code practices (client)

These are the habits the client code follows and why. `ui-conventions` has the exact folders, files and screens of nAIlbook, `ui-design` has how they look. If this skill and `ui-conventions` disagree, `ui-conventions` wins: report the conflict.

## 1. Folders by kind of code

Each folder holds one kind of code, so a reader knows where to look and a change stays in one place (the tree is in `ui-conventions`, *Structure*):

- `api/` talks to the server. Nothing else calls `fetch`, so the token, the error shape and the abort signal are handled once.
- `hooks/` holds state and effects that a component would otherwise carry itself.
- `contexts/` holds state many parts of the app need (who is logged in).
- `components/` are reusable parts; `pages/` are screens built from them.
- `utils/` holds plain functions with no React (`formatPrice`), easy to test and reuse.

A component file ends up mostly JSX: it reads hooks, calls handlers and renders.

## 2. Components and styles

- One component per folder, `<kebab-name>/<Name>.tsx` with its own `<Name>.module.css`. The module scopes the class names, so one component cannot break another.
- The JSX sets only module classes (`className={styles.card}`); the Tailwind classes live in the module with `@apply` (`ui-design`, *Where styles live*). Several classes are joined with `[styles.a, cond && styles.b].filter(Boolean).join(' ')`.
- Class names say the role (`.card`, `.fieldError`), not the look.
- A third-party widget's own classes are styled only inside the module, through `:global(...)` under a module class: `.carousel :global(.swiper) { ... }`. Never a global stylesheet.
- Props have a named type (`type ManicuristCardProps = { ... }`). Data types come from the API contract in `api/`, never redefined in a component.

## 3. Effects only for syncing, and inside hooks

`useEffect` is for keeping a component in sync with something outside React: a request, a `window` listener, a timer, a widget such as a Leaflet map or a Swiper carousel. It is not for anything React can compute.

- **Derived data is computed in render**, not stored with an effect. A filtered list, a label or a "has results" flag is a `const` in the component body.
- **Every effect cleans up** what it started: abort the request, remove the listener, clear the timer, destroy the widget.
- **Honest dependencies.** List everything the effect reads. No `eslint-disable` for `exhaustive-deps`; if a callback should not restart the effect, read it through `useEffectEvent`.
- **Reset by key, not by effect.** To start a form again with new values (Back, «Изчистете търсенето»), give it a `key` built from those values, as `SearchForm` gets the URL params. To adjust state when a prop changes, compare it during render (`if (userId !== shownUserId) { setShownUserId(userId); ... }`), not in an effect.
- **An effect goes into a hook** as soon as it has a name of its own: loading data (`useAsync`), a scroll or resize listener, a widget's setup. The component calls `const { data, loading } = useAsync(...)` instead of carrying the effect. A hook is added when the first screen needs it, not in advance.

## 4. Loading data with AbortController

Every load runs in `useAsync(fn, deps)` (`ui-conventions`, *Loading data*). The pattern:

```ts
useEffect(() => {
  const controller = new AbortController();
  setState((prev) => ({ ...prev, loading: true }));

  fn(controller.signal).then(
    (data) => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }); },
    (error: unknown) => {
      if (controller.signal.aborted) return; // the AbortError of a run we cancelled
      const message = error instanceof ApiError ? error.message : UNEXPECTED_ERROR_MESSAGE;
      setState((prev) => ({ ...prev, error: message, loading: false }));
    },
  );

  return () => controller.abort();
}, deps);
```

- **Why abort:** the user starts a new search, opens another manicurist or leaves the screen before the answer arrives. The cleanup aborts the old request, so an old answer can never replace a newer one on screen, and the browser stops waiting for it.
- **The signal goes all the way down:** `useAsync` → the API function (`searchManicurists(query, signal)`) → `request(path, { signal })` → `fetch`. An API function that loads data always takes `signal` as its last parameter.
- **An aborted request is not an error.** `request()` rethrows the `AbortError` as it is, and `useAsync` ignores it. It is never shown as «Няма връзка със сървъра».
- **The previous data stays while a new run loads**, so the page does not jump; `loading` drives a fixed-height «Зареждане…» line.
- **Submits are not aborted.** A POST, PUT or DELETE the user sent may already be saved on the server; aborting would only hide the answer. A submit is guarded by `pending` instead (§5).
- React's StrictMode runs every effect twice in development: the first run is aborted at once. That is expected and shows the cleanup works.

## 5. Controlled forms

- **Every form is controlled.** The values live in React state through `useForm`, each input has a `name`, `value={values.name}` and `onChange={changeHandler}`.
- **`submitHandler` calls `event.preventDefault()`**, so the page never reloads, and `useForm`'s `pending` blocks a second submit while the first one runs (the button is `disabled` and names the action: «Запазване…»).
- **The server validates.** Forms have `noValidate` and send every visible field as a string; field errors from `VALIDATION_ERROR` go under their inputs (`ui-conventions`, *Errors*). The client does not repeat the server's rules.
- **A search form is not a submit:** it only changes the URL, so it has no `pending` and its button stays enabled (`ui-design`, *States*).

## 6. Contexts

- One pair per context: `<Name>Context.ts` with `createContext` and its type, `<Name>Provider.tsx` with the state. Splitting them keeps the provider a component file and the context importable without it.
- A component reads a context only through its hook (`useAuth()`), never with `use(AuthContext)` directly, so the hook can check that a provider exists.
- A context is only for state many parts need. A screen's own data stays in the screen (or its hook).

## 7. The URL as state

What a user can share, reload or go Back to lives in the URL: the search (`/?city=…&service=…`), a filter, a page number. Read it with `useSearchParams` and write it with `setSearchParams`; the screen loads from the params. Do not copy the params into `useState` (two sources drift apart); the only local copy is the draft in the form's inputs.

## 8. Handlers and names

- A function that handles an event is named `<action>Handler` (`changeHandler`, `submitHandler`, `searchHandler`) and is passed to a child as `on<Action>` (`onSearch={searchHandler}`).
- Components and their files are PascalCase, folders kebab-case, hooks `useXxx`, plain helpers camelCase verbs (`formatPrice`).
- Comments explain why, not what; a short `/** */` above a non-obvious function says what it returns with an example (`2550 → «25,50 €»`).

## 9. Lists and clickable cards

- A list item's `key` is its id from the server, never the array index.
- **A whole card that opens a page uses a stretched link**, not an `<a>` around the card. The heading's link gets a pseudo-element that covers the card:

  ```css
  .card { @apply relative; }
  .link::after { content: ''; @apply absolute inset-0 rounded-xl; }
  .card:has(:focus-visible) { /* the same look as :hover, ui-design; keyboard focus only */ }
  ```

  The link's accessible name stays the name alone (an `<a>` around the card would read every line of it), there is one Tab stop per card, and the whole card is clickable. A card with its own buttons (a favourite, a cancel) puts them above the pseudo-element with `relative z-10`.
- **A card that selects instead of opening uses a stretched button** the same way. The manicurist card on `/` does not open a page: a click anywhere on it makes it the active card, and its marker on the map lights up (`ui-conventions`, Screens `/`). The name in the h3 is a `<button type="button">` with `aria-pressed` (true on the active card), its `::after` covers the card, and it looks like the heading text, not like a button. A click on the active card keeps it active (no toggle off). The h3 keeps the name as its accessible name.
- **A second link on the card** goes above the stretched element the same way, with `relative z-10`, and gets its own accessible name: «Запази час» on the manicurist card links to `/manicurists/:id#schedule` with `aria-label="Запази час при <име>"`, because «Запази час» alone would read the same on every card. Its visible text starts the name, so a voice user can say what they see. It is the only way from the card to the manicurist's page.
- **Hover and focus report the card:** the manicurist card calls `onHighlight(id)` on `mouseenter` and `focus` (in React, focus bubbles from its button and link) and `onHighlight(null)` on `mouseleave` and `blur`, so its map marker stands out while it lasts.

## 10. Carousel (Swiper)

The results carousel uses Swiper (`swiper/react`) with these rules:

- **Own arrow buttons**, real `<button>` elements with Bulgarian `aria-label`s («Предишни», «Следващи»), connected through `ref`s and `onSwiper` (or `navigation={{ prevEl, nextEl }}` with the elements from refs), not by a CSS selector string.
- **The `A11y` and `Keyboard` modules are on**, with Bulgarian messages, so the slides are announced and the arrow keys work.
- **No `loop`; `rewind` is allowed.** `loop` duplicates the slides when there are few results and confuses the active index that the map follows. `rewind: true` takes the arrows from the last view back to the first (and back from the first to the last) with no copies, so the arrows are never disabled.
- **Slides per view from `breakpoints`**: 1 on a phone, 2 from `sm`, 3 from `lg`, with `spaceBetween` from the spacing scale.
- **Room inside the carousel** (padding on `:global(.swiper)`) so the card's lift and shadow are not cut.
- **Equal slide heights:** `height: auto` on `:global(.swiper-slide)` and `h-full` on the card, so every card is as tall as the tallest and its last line («Запази час») lines up.
- **The counter** is a `role="status"` line with the cards in view: «Показани 1–3 от 6», or «Показана 1 от 6» when one card is in view (start = activeIndex + 1, end = min(activeIndex + perView, n); perView is `swiper.params.slidesPerView`, read again on `onBreakpoint`). Swiper's activeIndex can pass the last view (rewinding back to the end, a card focused with Tab), so the first card in view is `min(activeIndex, n − perView)`; the counter and the dots follow it. The active card does not: it is `activeId` (below).
- **The dots are `aria-hidden` decoration**, one per card, the cards in view marked and the first one wide. The counter says the same in words, so they are not buttons.
- **Reduced motion:** `speed: 0` from `useReducedMotion()`, so a slide changes at once.
- **A new search starts at the first card:** the component that holds the carousel, the map and `activeId` (`SearchResults`) gets a `key` from the search on screen, so the view and the active card start again together; never an effect that calls `slideTo(0)` or resets `activeId`.
- **The states come first:** loading, error and empty render before the carousel; Swiper renders only with results.
- **The active card is state the parent owns** (`activeId` in `SearchResults`, the first result's id at the start), passed to the carousel and the map. The carousel reports changes with `onActiveChange(id)`:
  - a click on a card, or on its marker, sets `activeId` to that card;
  - the user moving the carousel (the arrows, the arrow keys, a swipe, Tab to a card out of view) makes the first card in view active, from `onSlideChange`;
  - **one effect keeps the active card in view:** when `activeId` changes and its card is not between the first and the last card in view, the carousel calls `slideTo(index)` when the card is before the view and `slideTo(index − perView + 1)` when it is after it. A card already in view does not move the carousel. This one path serves both a card click and a marker click;
  - **a move the carousel asked for itself does not change `activeId`:** the carousel sets a ref flag around its own `slideTo` (in a `try/finally`), so `onSlideChange` does not replace the chosen card with the first in view. Swiper 14 emits `slideChange` synchronously inside `slideTo` even with `runCallbacks: false`, so that argument does not help;
  - on a breakpoint change `activeId` stays: the same flag is set in `onBeforeResize` and cleared in `onResize` (Swiper's own resize handling runs between them), and the effect brings its card back into view.

  Keep the Swiper instance in a ref, not in state, and never reach into it from outside the carousel.
- Import only the CSS Swiper needs (`swiper/css` and the modules used) inside the component that uses it.

## 11. Imperative widgets (Leaflet and the like)

A library that draws into a DOM node lives behind a component and a ref:

- Create the widget once in an effect on a `ref` (`L.map(ref.current)`) and destroy it in the cleanup (`map.remove()`), so StrictMode and route changes do not leave a second map.
- Update it in separate effects when its data changes (markers, the highlighted marker, `fitBounds`), instead of rebuilding it.
- The rest of the app talks to it through props and callbacks (`activeId`, `onMarkerSelect`), never by reaching into the widget.
- Keyboard and screen reader users get the same information outside the widget (the card's city, the page's address).

**The studio map (`components/studio-map/StudioMap`)** follows these rules with plain `leaflet` (never `react-leaflet`):

- **Props:** `markers` (`{ id, name, latitude, longitude }[]`, kept stable between renders: a new array draws the markers again), `activeId`, `highlightedId`, `onMarkerSelect?`, `zoomRequest?` (below) and `label`. The container is `role="region"` with `aria-label={label}`: Leaflet makes it focusable for panning with the arrow keys, and `aria-label` needs a role to be valid. Without `onMarkerSelect` the markers are pictures, not buttons.
- **The map fills its parent.** Its height, border, radius and shadow belong to a frame `<div>` in the parent (`SearchResults`, the manicurist page), so `StudioMap` has no size props.
- **Four effects:** one creates the map, one draws the markers, one marks the active and the highlighted marker, and one flies to the active marker (kept apart from the marking effect, so a hover never moves the map). The markers effect calls `fitBounds` with padding and `maxZoom: 15` (one result would otherwise zoom in to the street), or `setView` with zoom 16 for a single marker, always without animation: a new set of markers appears at once. So the start and every new search show all the studios.
- **A choice flies to the street:** `SearchResults` bumps a counter, the `zoomRequest` prop, on every choice of the user (a card, a marker, the arrows, also the active card chosen again), and on every change above 0 the map flies to the active marker at zoom 16 (`flyTo`, 0.8 s; `setView` without animation under reduced motion). The effect depends on `zoomRequest` only and reads the active marker through `useEffectEvent`, so a new active card alone never moves the map.
- **«Всички студиа»** is a `L.Control` with a real `<button>`, added by the markers effect when the markers are selectable and two or more, moved to the top of the top-left corner (Leaflet stacks a corner in the order controls are added), with `L.DomEvent.disableClickPropagation`. It calls `fitBounds` again, animated unless motion is reduced.
- **Markers are `L.divIcon`s** styled by the component's CSS Module (`ui-design`, Studio map), never Leaflet's default marker images. A selectable marker's element has `role="button"`, `aria-label="<име> на картата"` (different from the card's button, which is the name alone) and `aria-pressed` (true on the active one), and Enter and Space choose it; the focus stays on the marker. A marker without `onMarkerSelect` has `role="img"` with the same name and no Tab stop.
- **Options:** `scrollWheelZoom: false` and, when `matchMedia('(pointer: coarse)')` matches at creation, `dragging: false` (one finger scrolls the page; pinch and the zoom buttons still work), so the page never gets stuck on the map. `zoomControl: false` plus `L.control.zoom({ zoomInTitle: 'Приближи', zoomOutTitle: 'Отдалечи' })`. Under reduced motion (`useReducedMotion()` at creation), `zoomAnimation`, `fadeAnimation` and `markerZoomAnimation` are false and `panTo` and `fitBounds` run with `animate: false`.
- **Tiles:** one constant, `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (no `{s}` subdomains, as OSM asks today), `maxZoom: 19`, and the attribution `© <a href="https://www.openstreetmap.org/copyright">сътрудниците на OpenStreetMap</a>`, always visible, with no Leaflet link before it (`attributionControl.setPrefix(false)`). E2E never calls the tile server (`testing`, E2E).
- **Stacking:** the container has `isolation: isolate`, so Leaflet's panes (z-index 400–1000) never cover the header or the carousel arrows.
- Import `leaflet/dist/leaflet.css` inside the component.

## 12. Checklist before a change is done

- No `fetch` outside `api/`, no utility classes in JSX, no raw colours in modules.
- Every effect has a cleanup and honest dependencies; no derived state stored in an effect.
- Every load passes a `signal`; an aborted request shows nothing.
- Forms are controlled, `noValidate`, guarded by `pending`.
- A card that opens a page uses a stretched link, and a card that selects uses a stretched button; both work with Tab and Enter.
- It works at 375px and with the keyboard alone.
