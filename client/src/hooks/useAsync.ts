import { useEffect, useEffectEvent, useState, type DependencyList } from 'react';
import { ApiError, UNEXPECTED_ERROR_MESSAGE } from '../api/client';

export type AsyncState<T> = {
  /** The last loaded result. It stays while a new run loads, so the page does not jump. */
  data: T | null;
  /** The message to show: the ApiError message, else UNEXPECTED_ERROR_MESSAGE. */
  error: string | null;
  loading: boolean;
  /**
   * True when the last run could not reach the server (an ApiError with the code
   * NETWORK_ERROR); false again after a successful run. The screen then shows only
   * ConnectionError.
   */
  offline: boolean;
};

/**
 * Runs `fn` whenever `deps` change and returns its result. Each run gets its
 * own AbortController: `fn` passes the signal to the API function, and a new
 * run or leaving the screen aborts the old one, so an old answer never
 * replaces a newer one. Only for loads, never for submits.
 */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
    offline: false,
  });

  // Read through an effect event, so a new `fn` on every render does not restart the load; `deps` do.
  const run = useEffectEvent((signal: AbortSignal) => fn(signal));

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true }));

    run(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false, offline: false });
      },
      (error: unknown) => {
        // The AbortError of a run we cancelled is not an error to show.
        if (controller.signal.aborted) return;
        const message = error instanceof ApiError ? error.message : UNEXPECTED_ERROR_MESSAGE;
        const offline = error instanceof ApiError && error.code === 'NETWORK_ERROR';
        setState((prev) => ({ ...prev, error: message, loading: false, offline }));
      },
    );

    return () => controller.abort();
    // The caller's deps are the dependencies; `run` is an effect event and never one.
  }, deps);

  return state;
}
