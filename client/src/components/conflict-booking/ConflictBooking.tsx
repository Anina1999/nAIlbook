import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Booking } from '../../api/bookings';
import { useCancelBooking } from '../../hooks/useCancelBooking';
import { formatTimeRange } from '../../utils/format';
import Button from '../button/Button';
import CancelForm from '../cancel-form/CancelForm';
import ErrorMessage from '../error-message/ErrorMessage';
import styles from './ConflictBooking.module.css';

// Nothing to reload here: the bookings come from the day-off answer, and asking again
// would mean sending the day off again. A cancelled booking leaves through `onCancelled`;
// one the server refuses stays with its message.
const noReload = () => {};

type ConflictBookingProps = {
  /** An active booking on the date the manicurist wants to mark as a day off. */
  booking: Booking;
  /** Called after the booking was cancelled, to take it off the list. */
  onCancelled: (id: number) => void;
};

/**
 * One booking that stands in the way of a day off: the time, the service, the client and
 * their phone (only when there is one). A booking that has not started can be cancelled
 * with a reason; one that has started says so instead.
 */
export default function ConflictBooking({ booking, onCancelled }: ConflictBookingProps) {
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { cancel, pending, error, fieldError, reset } = useCancelBooking(noReload);

  // At 13:00 a 13:00 booking has started and the server no longer cancels it.
  const started = Date.parse(booking.startAt) <= Date.now();
  const { client } = booking;

  const submitHandler = async (reason: string) => {
    if (await cancel(booking.id, reason)) onCancelled(booking.id);
  };

  const backHandler = () => {
    // Render the button again first, so the focus can go back to it.
    flushSync(() => {
      setFormOpen(false);
      reset();
    });
    openButtonRef.current?.focus();
  };

  return (
    <li className={styles.row}>
      <p className={styles.time}>{formatTimeRange(booking.startAt, booking.endAt)}</p>
      <p className={styles.service}>{booking.serviceName}</p>
      <p className={styles.client}>
        <span className={styles.name}>{client.name}</span>
        {/* An empty phone is never shown, label included. */}
        {client.phone && (
          <span className={styles.phone}>
            <span className={styles.phoneLabel}>Телефон</span>{' '}
            <a href={`tel:${client.phone.replace(/\s/g, '')}`} className={styles.link}>
              {client.phone}
            </a>
          </span>
        )}
      </p>

      {error && <ErrorMessage message={error} />}

      {started ? (
        <p className={styles.note}>Часът вече е започнал и не може да бъде отменен.</p>
      ) : formOpen ? (
        <CancelForm pending={pending} fieldError={fieldError} onSubmit={submitHandler} onBack={backHandler} />
      ) : (
        <div className={styles.actions}>
          <Button ref={openButtonRef} variant="danger" onClick={() => setFormOpen(true)}>
            Отмени часа
          </Button>
        </div>
      )}
    </li>
  );
}
