import type { WorkingHours } from '../../api/manicurists';
import type { WeekSlots } from '../../hooks/useWeekSlots';
import { addDays, weekDates, weekdayOf } from '../../utils/dates';
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
  /** The loaded week. While a new week loads it is still the previous one, shown with aria-busy. */
  data: WeekSlots | null;
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

/**
 * The rows of the table: every 30 minutes from the earliest start of the
 * shown days to the latest time the service still fits before the end.
 */
function rowMinutes(dates: string[], workingHours: readonly WorkingHours[], durationMin: number): number[] {
  const hours = dates
    .map((date) => workingHours.find((h) => h.weekday === weekdayOf(date)))
    .filter((h): h is WorkingHours => h !== undefined);
  if (hours.length === 0) return [];
  const first = Math.min(...hours.map((h) => h.startMin));
  const last = Math.max(...hours.map((h) => h.endMin - durationMin));
  const rows: number[] = [];
  for (let minutes = first; minutes <= last; minutes += ROW_STEP_MIN) rows.push(minutes);
  return rows;
}

/**
 * A weekly timetable: a column per working day, a row per half hour. Only a
 * time /slots returned is a button; every other cell is «—», because the
 * client cannot know why a time is not free.
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
  const rows = data ? rowMinutes(columns, workingHours, data.durationMin) : [];
  // "<date>|<HH:mm>" → the slot, so each cell finds its free time on the Sofia clock.
  const free = new Map<string, string>();
  for (const [date, day] of Object.entries(data?.days ?? {})) {
    if (!day.dayOff) for (const slot of day.slots) free.set(`${date}|${formatTime(slot)}`, slot);
  }
  const isEmpty = free.size === 0;

  const renderCell = (date: string, minutes: number, rowIndex: number) => {
    if (data?.days[date]?.dayOff) {
      // One cell over all rows; the later rows have none for this column.
      if (rowIndex > 0) return null;
      return (
        <td key={date} rowSpan={rows.length} className={styles.dayOff}>
          <span className={styles.dayOffText}>Почивен ден</span>
        </td>
      );
    }
    const time = formatMinutes(minutes);
    const slot = free.get(`${date}|${time}`);
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

      {/* Always rendered with a fixed height, so «Зареждане…» does not move the table. */}
      <p role="status" className={styles.status}>
        {loading ? 'Зареждане…' : ''}
      </p>

      {data &&
        (isEmpty ? (
          <p className={styles.empty} aria-busy={loading}>
            Няма свободни часове през тази седмица. Изберете следваща седмица.
          </p>
        ) : (
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
        ))}
    </div>
  );
}
