import { useSearchParams } from 'react-router';
import type { Booking } from '../api/bookings';
import { isIsoDate, startOfWeek, weekdayOf, weekOfIso } from '../utils/dates';

export type MyBookingsWeek = {
  /** The Monday of the shown week: `?week=` when it is valid, else the default week. */
  week: string;
  /** The current Sofia week: «Предишна седмица» stops here. */
  firstWeek: string;
  /** The week of the last upcoming booking (any status), or the current week: «Следваща седмица» stops here. */
  lastWeek: string;
  selectWeek: (monday: string) => void;
};

/**
 * The week shown on `/my-bookings`, kept in the URL as `?week=YYYY-MM-DD` (the Monday)
 * and written with `replace`. The param is checked in render: a malformed one, one that
 * is not a Monday or one outside the weeks the arrows reach gives the default week, the
 * week of the soonest upcoming BOOKED booking (or the current week when there is none).
 * The URL is never rewritten for it. `upcoming` is null until the bookings have loaded;
 * it comes from the server soonest first.
 */
export function useMyBookingsWeek(upcoming: readonly Booking[] | null, today: string): MyBookingsWeek {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawWeek = searchParams.get('week') ?? '';

  const firstWeek = startOfWeek(today);
  // `YYYY-MM-DD` strings compare in calendar order. A booking in progress may have
  // started before this week, so the bounds never go below the current week.
  const lastWeek = (upcoming ?? []).reduce((last, booking) => {
    const week = weekOfIso(booking.startAt);
    return week > last ? week : last;
  }, firstWeek);

  const soonestBooked = upcoming?.find((booking) => booking.status === 'BOOKED');
  const soonestWeek = soonestBooked ? weekOfIso(soonestBooked.startAt) : firstWeek;
  const defaultWeek = soonestWeek < firstWeek ? firstWeek : soonestWeek;

  const weekIsValid =
    isIsoDate(rawWeek) && weekdayOf(rawWeek) === 1 && rawWeek >= firstWeek && rawWeek <= lastWeek;
  const week = weekIsValid ? rawWeek : defaultWeek;

  // replace, so Back leaves the page instead of stepping through every week.
  const selectWeek = (monday: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('week', monday);
        return next;
      },
      { replace: true },
    );

  return { week, firstWeek, lastWeek, selectWeek };
}
