import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useReducedMotion } from './useReducedMotion';

/**
 * When the URL's hash is `#<id>`, scrolls the element with that id into view the
 * first time `ready` is true (its content is on screen), and moves the focus to
 * the element inside it that has `tabIndex={-1}` (its heading), without a second
 * scroll. Runs once per page visit: a later change of `ready` does not scroll again.
 */
export function useScrollToHash(id: string, ready: boolean): void {
  const { hash } = useLocation();
  const reducedMotion = useReducedMotion();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !ready || hash !== `#${id}`) return;
    const target = document.getElementById(id);
    if (!target) return;
    done.current = true;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    target.querySelector<HTMLElement>('[tabindex="-1"]')?.focus({ preventScroll: true });
  }, [id, ready, hash, reducedMotion]);
}
