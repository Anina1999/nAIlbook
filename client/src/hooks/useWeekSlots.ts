import { getSlots, type Manicurist, type Service, type SlotsResponse } from '../api/manicurists';
import { weekDates } from '../utils/dates';
import { useAsync, type AsyncState } from './useAsync';

/** The free slots of one week, with the week and the service they belong to. */
export type WeekSlots = {
  /** The Monday of the week. */
  week: string;
  serviceId: number;
  durationMin: number;
  /** `/slots` per working date between today and the limit; the other dates are not requested. */
  days: Record<string, SlotsResponse>;
};

type WeekSlotsOptions = {
  manicurist: Manicurist | null;
  service: Service | null;
  /** The Monday of the week to load. */
  week: string;
  today: string;
  last: string;
  /** Bumped after a booking or a 409, so the week loads again. */
  reloadCount: number;
};

/**
 * Loads `/slots` for every working date of the week between today and the
 * 12-month limit, all with one signal, so a new week or service aborts every
 * request of the old one. The data is null while no service is chosen.
 */
export function useWeekSlots({
  manicurist,
  service,
  week,
  today,
  last,
  reloadCount,
}: WeekSlotsOptions): AsyncState<WeekSlots | null> {
  // The working hours come with the profile, which also turns serviceId from null into an id.
  const manicuristId = manicurist?.id ?? null;
  const serviceId = service?.id ?? null;

  return useAsync<WeekSlots | null>(
    async (signal) => {
      if (!manicurist || !service) return null;
      const dates = weekDates(
        week,
        manicurist.workingHours.map((hours) => hours.weekday),
      ).filter((date) => date >= today && date <= last);
      const responses = await Promise.all(dates.map((date) => getSlots(manicurist.id, service.id, date, signal)));
      return {
        week,
        serviceId: service.id,
        durationMin: service.durationMin,
        days: Object.fromEntries(dates.map((date, index) => [date, responses[index]])),
      };
    },
    [manicuristId, serviceId, week, today, last, reloadCount],
  );
}
