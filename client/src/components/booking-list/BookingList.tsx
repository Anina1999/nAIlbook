import type { Booking } from '../../api/bookings';
import { sofiaDateOfIso } from '../../utils/dates';
import { formatCancelledBy, formatLongDate, formatTimeRange } from '../../utils/format';
import Price from '../price/Price';
import StatusBadge from '../status-badge/StatusBadge';
import styles from './BookingList.module.css';

type BookingListProps = {
  /** At least one, in the order the server sends them (past bookings latest first). */
  bookings: readonly Booking[];
};

/**
 * Bookings as rows in one container (ui-design, Components, Bookings rows): the date,
 * the time, the service, the manicurist and the price; a cancelled one also says who
 * cancelled it and why. Read only: no buttons.
 */
export default function BookingList({ bookings }: BookingListProps) {
  return (
    <ul className={styles.list}>
      {bookings.map((booking) => (
        <li key={booking.id} className={styles.row}>
          {/* The spaces keep the parts apart when the row is read out. */}
          <p className={styles.when}>
            <span className={styles.date}>{formatLongDate(sofiaDateOfIso(booking.startAt))}</span>{' '}
            <span className={styles.time}>{formatTimeRange(booking.startAt, booking.endAt)}</span>
          </p>
          <p className={styles.what}>
            <span className={styles.service}>{booking.serviceName}</span>{' '}
            <span className={styles.name}>{booking.manicurist.name}</span>
          </p>
          <p className={styles.price}>
            <Price priceCents={booking.priceCents} />
          </p>
          {booking.status === 'CANCELLED' && (
            <p className={styles.cancelled}>
              <StatusBadge label="Отменен" /> {formatCancelledBy(booking.cancelledBy, 'CLIENT')}
              {booking.cancelReason && <> Причина: {booking.cancelReason}</>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
