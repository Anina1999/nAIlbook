# best-code-practices: loading data

Part of the `best-code-practices` skill ([SKILL.md](../SKILL.md)). §1–§3, §5–§8 and §12 are in SKILL.md.

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
