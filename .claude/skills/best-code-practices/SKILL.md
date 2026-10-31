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
  .card:focus-within { /* the same look as :hover, ui-design */ }
  ```

  The link's accessible name stays the name alone (an `<a>` around the card would read every line of it), there is one Tab stop per card, and the whole card is clickable. A card with its own buttons (a favourite, a cancel) puts them above the pseudo-element with `relative z-10`.
- **A second link on the card** goes above the stretched one the same way, with `relative z-10`, and gets its own accessible name: «Запази час» on the manicurist card links to `/manicurists/:id#schedule` with `aria-label="Запази час при <име>"`, because «Запази час» alone would read the same on every card. Its visible text starts the name, so a voice user can say what they see.

## 10. Carousel (Swiper)

The results carousel uses Swiper (`swiper/react`) with these rules:

- **Own arrow buttons**, real `<button>` elements with Bulgarian `aria-label`s («Предишни», «Следващи»), connected through `ref`s and `onSwiper` (or `navigation={{ prevEl, nextEl }}` with the elements from refs), not by a CSS selector string.
- **The `A11y` and `Keyboard` modules are on**, with Bulgarian messages, so the slides are announced and the arrow keys work.
- **No `loop`; `rewind` is allowed.** `loop` duplicates the slides when there are few results and confuses the active index that the map follows. `rewind: true` takes the arrows from the last view back to the first (and back from the first to the last) with no copies, so the arrows are never disabled.
- **Slides per view from `breakpoints`**: 1 on a phone, 2 from `sm`, 3 from `lg`, with `spaceBetween` from the spacing scale.
- **Room inside the carousel** (padding on `:global(.swiper)`) so the card's lift and shadow are not cut.
- **Equal slide heights:** `height: auto` on `:global(.swiper-slide)` and `h-full` on the card, so every card is as tall as the tallest and its last line («Запази час») lines up.
- **The counter** is a `role="status"` line with the cards in view: «Показани 1–3 от 6», or «Показана 1 от 6» when one card is in view (start = activeIndex + 1, end = min(activeIndex + perView, n); perView is `swiper.params.slidesPerView`, read again on `onBreakpoint`). Swiper's activeIndex can pass the last view (rewinding back to the end, a card focused with Tab), so the first card in view is `min(activeIndex, n − perView)`; the counter, the dots and the active card all follow it.
- **The dots are `aria-hidden` decoration**, one per card, the cards in view marked and the first one wide. The counter says the same in words, so they are not buttons.
- **Reduced motion:** `speed: 0` from `useReducedMotion()`, so a slide changes at once.
- **A new search starts at the first card:** the carousel gets a `key` from the search on screen, never an effect that calls `slideTo(0)`.
- **The states come first:** loading, error and empty render before the carousel; Swiper renders only with results.
- **The active slide is state the page owns:** `onSlideChange` reports `activeIndex`, and the page calls `swiper.slideTo(index)` when a map marker is chosen. Keep the Swiper instance in a ref, not in state.
- Import only the CSS Swiper needs (`swiper/css` and the modules used) inside the component that uses it.

## 11. Imperative widgets (Leaflet and the like)

A library that draws into a DOM node lives behind a component and a ref:

- Create the widget once in an effect on a `ref` (`L.map(ref.current)`) and destroy it in the cleanup (`map.remove()`), so StrictMode and route changes do not leave a second map.
- Update it in separate effects when its data changes (markers, the highlighted marker, `fitBounds`), instead of rebuilding it.
- The rest of the app talks to it through props and callbacks (`activeId`, `onMarkerSelect`), never by reaching into the widget.
- Keyboard and screen reader users get the same information outside the widget (the card's address and city).

## 12. Checklist before a change is done

- No `fetch` outside `api/`, no utility classes in JSX, no raw colours in modules.
- Every effect has a cleanup and honest dependencies; no derived state stored in an effect.
- Every load passes a `signal`; an aborted request shows nothing.
- Forms are controlled, `noValidate`, guarded by `pending`.
- A card that opens a page uses a stretched link and works with Tab and Enter.
- It works at 375px and with the keyboard alone.
