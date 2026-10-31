---
name: best-code-practices
description: React and TypeScript practices for nAIlbook's client, with the reasons behind them, covering folders by kind of code, components with CSS Modules, effects only for syncing and kept in hooks, data loading with AbortController, controlled forms, contexts, the URL as state, clickable cards, the Swiper carousel and imperative widgets such as Leaflet. Use when writing, reviewing or refactoring any code in client/. Works together with ui-conventions (the exact paths, screens and UI rules) and ui-design (the look).
---

# Best code practices (client)

These are the habits the client code follows and why. `ui-conventions` has the exact folders, files and screens of nAIlbook, `ui-design` has how they look. If this skill and `ui-conventions` disagree, `ui-conventions` wins: report the conflict.

## Reference files

§1–§3, §5–§8 and §12 are in this file and hold for every task. §4 and §9–§11 are in reference files; read one when the task needs it:

| File | Read it when |
|------|--------------|
| [references/data-loading.md](references/data-loading.md): §4 Loading data with AbortController | loading data in a screen or a hook, or writing an API function |
| [references/widgets.md](references/widgets.md): §9 Lists and clickable cards, §10 Carousel (Swiper), §11 Imperative widgets (Leaflet and the like) | rendering a list, building a clickable card, or touching the carousel, the studio map or another widget |

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

## 12. Checklist before a change is done

- No `fetch` outside `api/`, no utility classes in JSX, no raw colours in modules.
- Every effect has a cleanup and honest dependencies; no derived state stored in an effect.
- Every load passes a `signal`; an aborted request shows nothing.
- Forms are controlled, `noValidate`, guarded by `pending`.
- A card that opens a page uses a stretched link, and a card that selects uses a stretched button; both work with Tab and Enter.
- It works at 375px and with the keyboard alone.
