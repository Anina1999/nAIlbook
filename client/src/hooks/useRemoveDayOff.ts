import { useState } from 'react';
import { ApiError, UNEXPECTED_ERROR_MESSAGE } from '../api/client';
import { removeDayOff } from '../api/me';

/**
 * Removes a day off, with no confirmation: the date can be marked again with one click.
 * `removingId` is the day off being removed, so only its button says «Премахване…». A
 * server error (`404 NOT_FOUND`, `403 FORBIDDEN`) shows its message and calls `onReload`,
 * because the list on screen is out of date; `NETWORK_ERROR` only shows its message, since
 * a reload would fail the same way. After a removal `removed` is true and `onReload` loads
 * the list again. A submit: never aborted. `remove` resolves to true when it was removed.
 */
export function useRemoveDayOff(onReload: () => void) {
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const remove = async (id: number): Promise<boolean> => {
    if (removingId !== null) return false;
    setRemovingId(id);
    setError(null);
    setRemoved(false);
    try {
      await removeDayOff(id);
      setRemoved(true);
      onReload();
      return true;
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return false;
      }
      setError(err.message);
      if (err.code !== 'NETWORK_ERROR') onReload();
      return false;
    } finally {
      setRemovingId(null);
    }
  };

  return { remove, removingId, error, removed };
}
