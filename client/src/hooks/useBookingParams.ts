import { useSearchParams } from 'react-router';
import type { Manicurist } from '../api/manicurists';
import { addDays, isIsoDate, startOfWeek, weekDates, weekdayOf } from '../utils/dates';

export type BookingParams = {
  /** The service from `?service=`, or null when it is missing or not one of the services. */
  serviceId: number | null;
  /** The Monday of the shown week: `?week=` when it is valid, else the default week. */
  week: string;
  /** The current Sofia week: «Предишна седмица» stops here. */
  firstWeek: string;
  /** The week that holds the 12-month limit: «Следваща седмица» stops here. */
  lastWeek: string;
  selectService: (serviceId: number) => void;
  selectWeek: (monday: string) => void;
};

/**
 * The current Sofia week, or the next one when none of its working days is
 * left from today on (on a Saturday for a Monday-to-Friday manicurist).
 */
function defaultWeek(today: string, workingWeekdays: readonly number[]): string {
  const current = startOfWeek(today);
  return weekDates(current, workingWeekdays).some((date) => date >= today) ? current : addDays(current, 7);
}

/**
 * The booking choice kept in the URL: `?service=<id>&week=YYYY-MM-DD` (the
 * Monday), so a reload, a shared link and the return from login show the
 * same service and week. The params are checked in render: an unknown or
 * removed service is null, and a malformed week, one that is not a Monday or
 * one outside the bookable weeks gives the default week. The URL is never
 * rewritten for them. `manicurist` is null until the profile has loaded.
 */
export function useBookingParams(manicurist: Manicurist | null, today: string, last: string): BookingParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawService = searchParams.get('service') ?? '';
  const rawWeek = searchParams.get('week') ?? '';

  const firstWeek = startOfWeek(today);
  const lastWeek = startOfWeek(last);

  const serviceId =
    manicurist && /^[1-9]\d*$/.test(rawService) && manicurist.services.some((s) => s.id === Number(rawService))
      ? Number(rawService)
      : null;

  // `YYYY-MM-DD` strings compare in calendar order.
  const weekIsValid =
    isIsoDate(rawWeek) && weekdayOf(rawWeek) === 1 && rawWeek >= firstWeek && rawWeek <= lastWeek;
  const workingWeekdays = manicurist ? manicurist.workingHours.map((hours) => hours.weekday) : [];
  const week = weekIsValid ? rawWeek : defaultWeek(today, workingWeekdays);

  // Each write changes one param and keeps the other; replace, so Back leaves the page
  // instead of stepping through every choice.
  const setParam = (name: 'service' | 'week', value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(name, value);
        return next;
      },
      { replace: true },
    );

  return {
    serviceId,
    week,
    firstWeek,
    lastWeek,
    selectService: (id) => setParam('service', String(id)),
    selectWeek: (monday) => setParam('week', monday),
  };
}
