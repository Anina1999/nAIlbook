import type { Booking } from '../../api/bookings';
import { addDays, sofiaDateOfIso } from '../../utils/dates';
import {
  formatDateRange,
  formatDayMonth,
  formatLongDate,
  formatTimeRange,
  formatWeekBookingCount,
  formatWeekdayShort,
} from '../../utils/format';
import Price from '../price/Price';
import StatusBadge from '../status-badge/StatusBadge';
import styles from './BookingWeek.module.css';

type BookingWeekProps = {
  /** The Monday of the shown week; the title and the arrows follow it. */
  week: string;
  /** The first and the last week the arrows can reach. */
  firstWeek: string;
  lastWeek: string;
  onWeekChange: (monday: string) => void;
  /** The upcoming bookings of the shown week, by start time; cancelled ones included. */
  bookings: readonly Booking[];
  /** The booking shown in the details panel, or null. */
  activeId: number | null;
  onSelect: (id: number) => void;
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

/**
 * The client's upcoming bookings as a week board, Monday to Sunday on the Sofia
 * calendar: the week navigation, a count line and a day per column (stacked below
 * `lg`). A booking belongs to the Sofia date of its start. Every booking is a button
 * that makes it the active one; an empty day is an empty dashed area.
 */
export default function BookingWeek({
  week,
  firstWeek,
  lastWeek,
  onWeekChange,
  bookings,
  activeId,
  onSelect,
}: BookingWeekProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  return (
    <div className={styles.board}>
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
          {formatDateRange(week, addDays(week, 6))}
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

      <p role="status" className={styles.status}>
        {formatWeekBookingCount(bookings.length)}
      </p>

      <ol className={styles.days}>
        {days.map((date) => {
          const dayBookings = bookings.filter((booking) => sofiaDateOfIso(booking.startAt) === date);
          return (
            <li key={date} className={styles.day}>
              <h4 className={styles.dayHeading}>
                <span aria-hidden="true" className={styles.dayLabel}>
                  <span className={styles.weekday}>{formatWeekdayShort(date)}</span>{' '}
                  <span className={styles.dayMonth}>{formatDayMonth(date)}</span>
                </span>
                <span className={styles.srOnly}>{formatLongDate(date)}</span>
              </h4>
              {dayBookings.length > 0 ? (
                <ul className={styles.bookings}>
                  {dayBookings.map((booking) => (
                    <li key={booking.id}>
                      <BookingButton
                        booking={booking}
                        date={date}
                        active={booking.id === activeId}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                // Visibly empty, with no filler text; a screen reader still hears that the day is free.
                <div className={styles.empty}>
                  <span className={styles.srOnly}>Няма часове.</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type BookingButtonProps = {
  booking: Booking;
  /** Its Sofia date, read out first, because the day heading is not part of the button's name. */
  date: string;
  active: boolean;
  onSelect: (id: number) => void;
};

function BookingButton({ booking, date, active, onSelect }: BookingButtonProps) {
  const cancelled = booking.status === 'CANCELLED';
  return (
    <button
      type="button"
      className={[styles.booking, cancelled && styles.cancelled].filter(Boolean).join(' ')}
      aria-pressed={active}
      onClick={() => onSelect(booking.id)}
    >
      {/* The spaces keep the parts apart in the button's accessible name. */}
      <span className={styles.srOnly}>{formatLongDate(date)}, </span>
      <span className={styles.time}>{formatTimeRange(booking.startAt, booking.endAt)}</span>{' '}
      <span className={styles.service}>{booking.serviceName}</span>{' '}
      <span className={styles.name}>{booking.manicurist.name}</span>{' '}
      <span className={styles.meta}>
        <Price priceCents={booking.priceCents} />
        {cancelled && (
          <>
            {' '}
            <StatusBadge label="Отменен" tone={active ? 'inverse' : 'default'} />
          </>
        )}
      </span>
    </button>
  );
}
