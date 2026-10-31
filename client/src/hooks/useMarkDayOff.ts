import { useState } from 'react';
import type { Booking } from '../api/bookings';
import { ApiError, UNEXPECTED_ERROR_MESSAGE, validationDetails } from '../api/client';
import { markDayOff } from '../api/me';

/** A `409 DAY_HAS_BOOKINGS` answer: the date, the server's message and the bookings still on it. */
export type DayOffConflict = {
  date: string;
  message: string;
  /** The bookings not cancelled yet, by start time. */
  bookings: Booking[];
  /** How many bookings the server returned, so the screen knows one was cancelled since. */
  total: number;
};

/** The codes whose message belongs under the date field (api-conventions, `POST /api/me/days-off`). */
const DATE_ERROR_CODES = ['SLOT_INVALID', 'ALREADY_DAY_OFF'];

function bookingsOf(details: unknown): Booking[] {
  if (typeof details !== 'object' || details === null) return [];
  const { bookings } = details as { bookings?: unknown };
  return Array.isArray(bookings) ? (bookings as Booking[]) : [];
}

/**
 * Marks a date as a day off. A `VALIDATION_ERROR` on `date`, `400 SLOT_INVALID` and `409
 * ALREADY_DAY_OFF` become the field error; `409 DAY_HAS_BOOKINGS` becomes `conflict`, with
 * the bookings on that date; any other `ApiError` shows the server's message, anything else
 * `UNEXPECTED_ERROR_MESSAGE`. After a success `added` is true and `onAdded` loads the list
 * again. A submit: never aborted, guarded by `pending`. `mark` resolves to true on success.
 */
export function useMarkDayOff(onAdded: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DayOffConflict | null>(null);
  const [added, setAdded] = useState(false);

  const mark = async (date: string): Promise<boolean> => {
    if (pending) return false;
    setPending(true);
    setError(null);
    setFieldError(null);
    setConflict(null);
    setAdded(false);
    try {
      await markDayOff(date);
      setAdded(true);
      onAdded();
      return true;
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return false;
      }
      if (err.code === 'DAY_HAS_BOOKINGS') {
        const bookings = bookingsOf(err.details);
        setConflict({ date, message: err.message, bookings, total: bookings.length });
      } else if (err.code === 'VALIDATION_ERROR') {
        const detail = validationDetails(err).find((d) => d.path === 'date');
        // The form has one field; an issue on any other path goes into the error box.
        if (detail) setFieldError(detail.message);
        else setError(err.message);
      } else if (DATE_ERROR_CODES.includes(err.code)) {
        setFieldError(err.message);
      } else {
        setError(err.message);
      }
      return false;
    } finally {
      setPending(false);
    }
  };

  /** Takes a cancelled booking off the conflict, so only the ones still in the way stay. */
  const dropConflictBooking = (id: number) => {
    setConflict((prev) => prev && { ...prev, bookings: prev.bookings.filter((b) => b.id !== id) });
  };

  return { mark, pending, error, fieldError, conflict, added, dropConflictBooking };
}
