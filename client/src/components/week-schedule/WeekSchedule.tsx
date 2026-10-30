import type { WorkingHours } from '../../api/manicurists';
import type { WeekSlots } from '../../hooks/useWeekSlots';
import { addDays, minutesInSofia, weekDates, weekdayOf } from '../../utils/dates';
import {
  formatDateRange,
  formatDayMonth,
  formatLongDate,
  formatMinutes,
  formatTime,
  formatWeekdayShort,
} from '../../utils/format';
import ErrorMessage from '../error-message/ErrorMessage';
import styles from './WeekSchedule.module.css';

/** The slot grid: rows every 30 minutes (scheduling-engine). */
const ROW_STEP_MIN = 30;

type WeekScheduleProps = {
  /** The Monday of the week asked for; the title and the arrows follow it. */
  week: string;
  /** The first and the last week the arrows can reach. */
  firstWeek: string;
  lastWeek: string;
  onWeekChange: (monday: string) => void;
  workingHours: readonly WorkingHours[];
  /**
   * The loaded week. While a new week or service loads it is still the previous
   * one, shown with aria-busy. Without a service (`serviceId` null: the manicurist
   * has none) it has only busy times and days off.
   */
  data: WeekSlots | null;
  /** True while a load runs or `data` is not yet the week and service asked for. */
  loading: boolean;
  error: string | null;
  /** The chosen slot (UTC ISO), or null. */
  selected: string | null;
  onSelect: (date: string, slot: string) => void;
};

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className={styles.icon}>
      <path
        d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** «2 – 8 ноември 2026 г.» for the week that starts on `monday`. */
function weekTitle(monday: string): string {
  return formatDateRange(monday, addDays(monday, 6));
}

/** A busy interval on the Sofia clock, in minutes from midnight. */
type Block = {
  start: number;
  end: number;
  /** «11:30–12:10» */
  times: string;
};

/** One loaded date: the free starts by their Sofia minutes, and the busy blocks. */
type Day = {
  dayOff: boolean;
  free: Map<number, string>;
  busy: Block[];
};

const MINUTES_PER_DAY = 24 * 60;

/** The loaded dates with every time on the Sofia clock, never the browser's. */
function toDays(data: WeekSlots | null): Record<string, Day> {
  const days: Record<string, Day> = {};
  for (const [date, response] of Object.entries(data?.days ?? {})) {
    days[date] = {
      dayOff: response.dayOff,
      // Only the starts /slots returned are free; nothing is derived from `busy`.
      free: new Map(response.slots.map((slot) => [minutesInSofia(slot), slot])),
      busy: response.busy.map(({ startAt, endAt }) => {
        const start = minutesInSofia(startAt);
        const end = minutesInSofia(endAt);
        return {
          start,
          // A booking that ends at midnight ends at the end of this day, not at 00:00.
          end: end > start ? end : MINUTES_PER_DAY,
          times: `${formatTime(startAt)}–${formatTime(endAt)}`,
        };
      }),
    };
  }
  return days;
}

/**
 * The rows of the table: every 30 minutes from the earliest start to the
 * latest end of the shown days, stretched to cover a busy block outside the
 * working hours, plus a row for every free start and every busy start or end
 * off the grid (12:10 after a 40-minute booking at 11:30).
 */
function rowMinutes(dates: string[], workingHours: readonly WorkingHours[], days: Record<string, Day>): number[] {
  const hours = dates
    .map((date) => workingHours.find((h) => h.weekday === weekdayOf(date)))
    .filter((h): h is WorkingHours => h !== undefined);
  if (hours.length === 0) return [];
  const shown = dates.map((date) => days[date]).filter((day): day is Day => day !== undefined);
  const blocks = shown.flatMap((day) => day.busy);
  const first = Math.min(...hours.map((h) => h.startMin), ...blocks.map((b) => b.start));
  const end = Math.max(...hours.map((h) => h.endMin), ...blocks.map((b) => b.end));

  const rows = new Set<number>();
  // The grid is aligned to :00 and :30 on the Sofia clock (scheduling-engine).
  for (let minutes = Math.floor(first / ROW_STEP_MIN) * ROW_STEP_MIN; minutes < end; minutes += ROW_STEP_MIN) {
    rows.add(minutes);
  }
  for (const day of shown) for (const minutes of day.free.keys()) rows.add(minutes);
  for (const block of blocks) {
    rows.add(block.start);
    // An end at the bottom of the table has nothing after it, so it needs no row.
    if (block.end < end) rows.add(block.end);
  }
  return [...rows].sort((a, b) => a - b);
}

/**
 * The one line above the table: «Зареждане…» while a week loads, else what the
 * loaded week lacks, else nothing. A week loaded without a service means the
 * manicurist has none (the page always picks one when there is one).
 */
function statusText(data: WeekSlots | null, loading: boolean, hasFreeTime: boolean): string {
  if (loading) return 'Зареждане…';
  if (!data) return '';
  if (data.serviceId === null) return 'Маникюристът не е добавил услуги.';
  if (!hasFreeTime) return 'Няма свободни часове през тази седмица. Изберете следваща седмица.';
  return '';
}

/**
 * A weekly timetable built from the working hours: a column per working day,
 * a row per half hour and per off-grid time. Only a time /slots returned is a
 * button, and only a `busy` interval is «Заето», one cell over its rows; every
 * other cell is «—», because the client cannot know why a time is not free.
 */
export default function WeekSchedule({
  week,
  firstWeek,
  lastWeek,
  onWeekChange,
  workingHours,
  data,
  loading,
  error,
  selected,
  onSelect,
}: WeekScheduleProps) {
  const columns = data ? weekDates(data.week, workingHours.map((h) => h.weekday)) : [];
  const days = toDays(data);
  const rows = data ? rowMinutes(columns, workingHours, days) : [];
  const hasFreeTime = Object.values(days).some((day) => !day.dayOff && day.free.size > 0);

  const renderCell = (date: string, minutes: number, rowIndex: number) => {
    const day = days[date];
    if (day?.dayOff) {
      // One cell over all rows; the later rows have none for this column.
      if (rowIndex > 0) return null;
      return (
        <td key={date} rowSpan={rows.length} className={styles.dayOff}>
          <span className={styles.dayOffText}>Почивен ден</span>
        </td>
      );
    }
    const block = day?.busy.find((b) => b.start <= minutes && minutes < b.end);
    if (block) {
      // One cell from the block's start row to the row before its end; the rows it covers have none.
      if (block.start !== minutes) return null;
      const span = rows.filter((row) => row >= block.start && row < block.end).length;
      return (
        <td key={date} rowSpan={span} className={styles.busy}>
          {/* The space keeps the cell's name «Заето 11:30–12:10»; below sm the times are only read out. */}
          <span className={styles.busyLabel}>Заето</span>{' '}
          <span className={styles.busyTimes}>{block.times}</span>
        </td>
      );
    }
    const time = formatMinutes(minutes);
    const slot = day?.free.get(minutes);
    if (!slot) {
      return (
        <td key={date} className={styles.cell}>
          <span aria-hidden="true" className={styles.none}>
            —
          </span>
          <span className={styles.srOnly}>няма свободен час</span>
        </td>
      );
    }
    return (
      <td key={date} className={styles.cell}>
        <button
          type="button"
          className={styles.slot}
          aria-label={`${formatLongDate(date)}, ${time}`}
          aria-pressed={slot === selected}
          onClick={() => onSelect(date, slot)}
        >
          {/* Below sm the chip has no text; its aria-label names it. */}
          <span className={styles.time}>{time}</span>
        </button>
      </td>
    );
  };

  return (
    <div className={styles.schedule}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Предишна седмица"
          disabled={week <= firstWeek}
          onClick={() => onWeekChange(addDays(week, -7))}
        >
          <ChevronIcon direction="left" />
        </button>
        {/* Announced when the week changes. */}
        <h3 className={styles.title} aria-live="polite">
          {weekTitle(week)}
        </h3>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Следваща седмица"
          disabled={week >= lastWeek}
          onClick={() => onWeekChange(addDays(week, 7))}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* One line, always rendered with a fixed height, so its text does not move the table. */}
      <p role="status" className={styles.status}>
        {statusText(data, loading, hasFreeTime)}
      </p>

      {data && (
        // Scrolls on its own only if a 7-day week cannot fit, so the page itself never does.
        <div className={styles.scroller}>
          <table className={styles.table} aria-busy={loading}>
            <caption className={styles.srOnly}>{weekTitle(data.week)}</caption>
            <thead>
              <tr>
                <td className={styles.corner} />
                {columns.map((date) => (
                  <th key={date} scope="col" className={styles.colHeader}>
                    {/* The short underline sits under this label, so the row reads as headings. */}
                    <span aria-hidden="true" className={styles.headerLabel}>
                      <span className={styles.weekday}>{formatWeekdayShort(date)}</span>{' '}
                      <span className={styles.dayMonth}>{formatDayMonth(date)}</span>
                    </span>
                    <span className={styles.srOnly}>{formatLongDate(date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((minutes, rowIndex) => (
                <tr key={minutes}>
                  <th scope="row" className={styles.rowHeader}>
                    {formatMinutes(minutes)}
                  </th>
                  {columns.map((date) => renderCell(date, minutes, rowIndex))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
