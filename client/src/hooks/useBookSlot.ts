import { useState } from 'react';
import { createBooking, type Booking, type BookingInput } from '../api/bookings';
import { ApiError, UNEXPECTED_ERROR_MESSAGE } from '../api/client';

/** The conflicts after which the slots on screen are out of date. */
const RELOAD_CODES = new Set(['SLOT_TAKEN', 'DAY_OFF']);

/**
 * Books a slot. `onReload` is called after a booking and after a 409
 * SLOT_TAKEN or DAY_OFF, so the page loads the free slots again; the error
 * is the server's message. A submit: never aborted, guarded by `pending`.
 */
export function useBookSlot(onReload: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booking | null>(null);

  const book = async (input: BookingInput) => {
    if (pending) return;
    setPending(true);
    setError(null);
    setBooked(null);
    try {
      const { booking } = await createBooking(input);
      setBooked(booking);
      onReload();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return;
      }
      setError(err.message);
      if (RELOAD_CODES.has(err.code)) onReload();
    } finally {
      setPending(false);
    }
  };

  /** Clears the confirmation and the error, when the user picks another time. */
  const reset = () => {
    setError(null);
    setBooked(null);
  };

  return { book, pending, error, booked, reset };
}
