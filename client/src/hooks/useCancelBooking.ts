import { useState } from 'react';
import { cancelBooking } from '../api/bookings';
import { ApiError, UNEXPECTED_ERROR_MESSAGE, validationDetails } from '../api/client';

/**
 * Cancels a booking with a reason. A `VALIDATION_ERROR` on `reason` becomes the field
 * error and the list stays as it is; any other `ApiError` (`409 NOT_CANCELLABLE`, `403
 * FORBIDDEN`) shows the server's message and calls `onReload`, because the booking on
 * screen is out of date; anything else shows `UNEXPECTED_ERROR_MESSAGE`. After a
 * cancellation `cancelled` is true and `onReload` loads the list again. A submit: never
 * aborted, guarded by `pending`. `cancel` resolves to true when the booking was cancelled.
 */
export function useCancelBooking(onReload: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const cancel = async (id: number, reason: string): Promise<boolean> => {
    if (pending) return false;
    setPending(true);
    setError(null);
    setFieldError(null);
    setCancelled(false);
    try {
      await cancelBooking(id, reason);
      setCancelled(true);
      onReload();
      return true;
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return false;
      }
      if (err.code === 'VALIDATION_ERROR') {
        const detail = validationDetails(err).find((d) => d.path === 'reason');
        // The form has one field; an issue on any other path goes into the error box.
        if (detail) setFieldError(detail.message);
        else setError(err.message);
        return false;
      }
      setError(err.message);
      onReload();
      return false;
    } finally {
      setPending(false);
    }
  };

  /** Clears the errors, when the form is closed. */
  const reset = () => {
    setError(null);
    setFieldError(null);
  };

  return { cancel, pending, error, fieldError, cancelled, reset };
}
