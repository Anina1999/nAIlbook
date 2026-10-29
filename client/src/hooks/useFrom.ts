import { useLocation } from 'react-router';

/** Where a guest came from before login or registration (`state.from`), else `/`. */
export function useFrom(): string {
  const location = useLocation();
  return (location.state as { from?: string } | null)?.from ?? '/';
}
