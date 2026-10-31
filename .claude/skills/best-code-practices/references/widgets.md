# best-code-practices: lists, cards and widgets

Part of the `best-code-practices` skill ([SKILL.md](../SKILL.md)). §1–§3, §5–§8 and §12 are in SKILL.md.

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
- **A choice flies to the street:** `SearchResults` bumps a counter, the `zoomRequest` prop, on every choice of the user (a card, a marker, the arrows, also the active card chosen again), and on every change above 0 the map flies to the active marker at zoom 16 (`flyTo`, 0.8 s a step; `setView` without animation under reduced motion). The effect depends on `zoomRequest` only and reads the active marker through `useEffectEvent`, so a new active card alone never moves the map. **The flight goes in steps of at most 5 zoom levels and waits for each step's tiles** (the layer's `load` event, at most 1.5 s), because while new tiles load Leaflet shows loaded tiles of only up to 5 levels above them: one jump from the country (7) to the street (16) shows empty ground. The tile layer has `updateWhenZooming: false`, so the levels passed during a step load no tiles. A counter ref stops an older flight between its steps when a new choice, «Всички студиа» or a redraw comes, and the number of steps is capped, so a flight always ends.
- **«Всички студиа»** is a `L.Control` with a real `<button>`, added by the markers effect when the markers are selectable and two or more, moved to the top of the top-left corner (Leaflet stacks a corner in the order controls are added), with `L.DomEvent.disableClickPropagation`. It calls `fitBounds` again, animated unless motion is reduced.
- **Markers are `L.divIcon`s** styled by the component's CSS Module (`ui-design`, Studio map), never Leaflet's default marker images. A selectable marker's element has `role="button"`, `aria-label="<име> на картата"` (different from the card's button, which is the name alone) and `aria-pressed` (true on the active one), and Enter and Space choose it; the focus stays on the marker. A marker without `onMarkerSelect` has `role="img"` with the same name and no Tab stop.
- **Options:** the wheel zooms only with Ctrl (⌘ on a Mac), as on embedded Google Maps (decided 2026-10-31): `scrollWheelZoom: true`, and a `wheel` listener in the capture phase on the container stops every turn without `ctrlKey` or `metaKey` before Leaflet sees it (passive, no `preventDefault`, so the page scrolls on) and shows for 1.5 s the hint «Задръжте Ctrl и завъртете колелото, за да приближите картата.» («⌘» on a Mac), an `aria-hidden` line over the map. When `matchMedia('(pointer: coarse)')` matches at creation, `dragging: false` (one finger scrolls the page; pinch and the zoom buttons still work). So the page never gets stuck on the map. `zoomControl: false` plus `L.control.zoom({ zoomInTitle: 'Приближи', zoomOutTitle: 'Отдалечи' })`. Under reduced motion (`useReducedMotion()` at creation), `zoomAnimation`, `fadeAnimation` and `markerZoomAnimation` are false and `panTo` and `fitBounds` run with `animate: false`.
- **Tiles:** one constant, `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (no `{s}` subdomains, as OSM asks today), `maxZoom: 19`, and the attribution `© <a href="https://www.openstreetmap.org/copyright">сътрудниците на OpenStreetMap</a>`, always visible, with no Leaflet link before it (`attributionControl.setPrefix(false)`). E2E never calls the tile server (`testing`, E2E).
- **Stacking:** the container has `isolation: isolate`, so Leaflet's panes (z-index 400–1000) never cover the header or the carousel arrows.
- Import `leaflet/dist/leaflet.css` inside the component.
