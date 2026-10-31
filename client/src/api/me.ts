import { request } from './client';

/** A manicurist's own day off; `date` is a Sofia `YYYY-MM-DD`. */
export type DayOff = {
  id: number;
  date: string;
};

/** The logged-in manicurist's active days off from today on, soonest first. A load, so it takes the signal. */
export function getMyDaysOff(signal?: AbortSignal): Promise<{ daysOff: DayOff[] }> {
  return request<{ daysOff: DayOff[] }>('/me/days-off', { signal });
}

/**
 * Marks a date as a day off. `409 DAY_HAS_BOOKINGS` carries `details.bookings`, the active
 * bookings on that date. A submit, so it takes no signal and is never aborted.
 */
export function markDayOff(date: string): Promise<{ dayOff: DayOff }> {
  return request<{ dayOff: DayOff }>('/me/days-off', { method: 'POST', body: { date } });
}

/** Removes a day off, so the date can be booked again. A submit, so it takes no signal. */
export function removeDayOff(id: number): Promise<void> {
  return request<void>(`/me/days-off/${id}`, { method: 'DELETE' });
}
