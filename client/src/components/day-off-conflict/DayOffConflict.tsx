import { useId, useRef } from 'react';
import type { DayOffConflict as Conflict } from '../../hooks/useMarkDayOff';
import { formatLongDate } from '../../utils/format';
import ConflictBooking from '../conflict-booking/ConflictBooking';
import ErrorMessage from '../error-message/ErrorMessage';
import styles from './DayOffConflict.module.css';

type DayOffConflictProps = {
  conflict: Conflict;
  /** Takes a cancelled booking off the conflict. */
  onBookingCancelled: (id: number) => void;
};

/**
 * The `DAY_HAS_BOOKINGS` warning under the day-off form: the server's message and the
 * bookings on that date, each with its own cancel form. When none is left, it says the
 * day can be marked now; «Добави» then tries the same date again.
 */
export default function DayOffConflict({ conflict, onBookingCancelled }: DayOffConflictProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cleared = conflict.bookings.length === 0;

  let status = '';
  if (cleared) status = 'Всички часове на тази дата са отменени. Вече можете да отбележите деня като почивен.';
  else if (conflict.bookings.length < conflict.total) status = 'Часът е отменен.';

  const cancelledHandler = (id: number) => {
    onBookingCancelled(id);
    // The row and its form are gone; the focus goes to the panel, where the status is announced.
    titleRef.current?.focus();
  };

  return (
    <section aria-labelledby={titleId} className={styles.panel}>
      {!cleared && <ErrorMessage message={conflict.message} />}
      <h3 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
        Часове на {formatLongDate(conflict.date)}
      </h3>
      {/* Always rendered, so a cancellation is announced. */}
      <p role="status" className={styles.success}>
        {status}
      </p>
      {!cleared && (
        <ul className={styles.list}>
          {conflict.bookings.map((booking) => (
            <ConflictBooking key={booking.id} booking={booking} onCancelled={cancelledHandler} />
          ))}
        </ul>
      )}
    </section>
  );
}
