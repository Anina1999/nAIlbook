import { getSlots, type Manicurist, type Service, type SlotsResponse } from '../api/manicurists';
import { weekDates } from '../utils/dates';
import { useAsync, type AsyncState } from './useAsync';

/** One week of `/slots`, with the week and the service it was loaded for. */
export type WeekSlots = {
  /** The Monday of the week. */
  week: string;
  /**
   * The chosen service, or null when the manicurist has none: then every day's
   * `slots` is `[]` and only `busy` and `dayOff` count.
   */
  serviceId: number | null;
  /** `/slots` per working date between today and the limit; the other dates are not requested. */
  days: Record<string, SlotsResponse>;
};

type WeekSlotsOptions = {
  manicurist: Manicurist | null;
  /** Null when the manicurist has no service: the week still loads, for its busy times and days off. */
  service: Service | null;
  /** The Monday of the week to load. */
  week: string;
  today: string;
  last: string;
  /** Bumped after a booking or a conflict, so the week loads again. */
  reloadCount: number;
};

/**
 * Loads `/slots` for every working date of the week between today and the
 * 12-month limit, all with one signal, so a new week or service aborts every
 * request of the old one. Without a service the requests carry no
 * `serviceId`. The data is null until the profile has loaded.
 */
export function useWeekSlots({
  manicurist,
  service,
  week,
  today,
  last,
  reloadCount,
}: WeekSlotsOptions): AsyncState<WeekSlots | null> {
  // The working hours come with the profile, which also turns the id from null into a number.
  const manicuristId = manicurist?.id ?? null;
  const serviceId = service?.id ?? null;

  return useAsync<WeekSlots | null>(
    async (signal) => {
      if (!manicurist) return null;
      const dates = weekDates(
        week,
        manicurist.workingHours.map((hours) => hours.weekday),
      ).filter((date) => date >= today && date <= last);
      const responses = await Promise.all(dates.map((date) => getSlots(manicurist.id, serviceId, date, signal)));
      return {
        week,
        serviceId,
        days: Object.fromEntries(dates.map((date, index) => [date, responses[index]])),
      };
    },
    [manicuristId, serviceId, week, today, last, reloadCount],
  );
}
