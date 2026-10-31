import { useSearchParams } from 'react-router';
import { isIsoDate, lastBookableDate, todayInSofia } from '../utils/dates';

export type ScheduleDate = {
  /** The shown Sofia date: `?date=` when it is valid, else today. */
  date: string;
  /** Today in Sofia, the default date. */
  today: string;
  /** The 12-month limit: «Следващ ден» stops here. */
  lastDate: string;
  selectDate: (date: string) => void;
};

/**
 * The day shown on `/schedule`, kept in the URL as `?date=YYYY-MM-DD` and written with
 * `replace`. The param is checked in render: a malformed date or one after the 12-month
 * limit gives today; past dates are valid, so the manicurist can look back. The URL is
 * never rewritten for it.
 */
export function useScheduleDate(): ScheduleDate {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawDate = searchParams.get('date') ?? '';

  const today = todayInSofia();
  const lastDate = lastBookableDate(today);
  // `YYYY-MM-DD` strings compare in calendar order.
  const date = isIsoDate(rawDate) && rawDate <= lastDate ? rawDate : today;

  // replace, so Back leaves the page instead of stepping through every day.
  const selectDate = (next: string) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('date', next);
        return params;
      },
      { replace: true },
    );

  return { date, today, lastDate, selectDate };
}
