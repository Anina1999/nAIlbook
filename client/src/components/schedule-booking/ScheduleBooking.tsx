import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Booking } from '../../api/bookings';
import { useCancelBooking } from '../../hooks/useCancelBooking';
import { formatCancelledBy, formatTimeRange } from '../../utils/format';
import Button from '../button/Button';
import CancelForm from '../cancel-form/CancelForm';
import ErrorMessage from '../error-message/ErrorMessage';
import Price from '../price/Price';
import StatusBadge from '../status-badge/StatusBadge';
import styles from './ScheduleBooking.module.css';

type ScheduleBookingProps = {
  /** One of the manicurist's bookings; cancelled ones included. */
  booking: Booking;
  /** Called after the booking was cancelled; the parent announces it and moves the focus. */
  onCancelled: (id: number) => void;
  /**
   * Passed to `useCancelBooking`: called after a cancellation and after a server error
   * that makes the row out of date, so the parent can load its bookings again.
   */
  onReload: () => void;
};

/**
 * One of the manicurist's bookings as a row: the time, the service and the price, the
 * client and their phone (only when there is one), and its status. A `BOOKED` booking
 * that has not started can be cancelled with a reason; one in progress says so; one that
 * has ended shows nothing more. A cancelled one says who cancelled it and why. The row
 * has no status line of its own: the parent announces the cancellation.
 */
export default function ScheduleBooking({ booking, onCancelled, onReload }: ScheduleBookingProps) {
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { cancel, pending, error, fieldError, cancelled, reset } = useCancelBooking(onReload);

  const now = Date.now();
  const booked = booking.status === 'BOOKED';
  // At 13:00 a 13:00 booking has started and the server no longer cancels it.
  const started = Date.parse(booking.startAt) <= now;
  const inProgress = booked && started && now < Date.parse(booking.endAt);
  // Once cancelled, the button stays away until the parent's data has the new status.
  const canCancel = booked && !started && !cancelled;
  const { client } = booking;

  const submitHandler = async (reason: string) => {
    if (await cancel(booking.id, reason)) {
      setFormOpen(false);
      onCancelled(booking.id);
    }
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
    <li className={[styles.row, booking.status === 'CANCELLED' && styles.cancelledRow].filter(Boolean).join(' ')}>
      <p className={styles.time}>{formatTimeRange(booking.startAt, booking.endAt)}</p>
      <p className={styles.service}>
        {booking.serviceName}, <Price priceCents={booking.priceCents} />
      </p>
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

      {booking.status === 'CANCELLED' && (
        <div className={styles.cancelInfo}>
          <StatusBadge label="Отменен" />
          <p>{formatCancelledBy(booking.cancelledBy, 'MANICURIST')}</p>
          {booking.cancelReason && <p className={styles.reason}>Причина: {booking.cancelReason}</p>}
        </div>
      )}

      {inProgress && <p className={styles.note}>Часът вече е започнал и не може да бъде отменен.</p>}

      {error && <ErrorMessage message={error} />}

      {canCancel &&
        (formOpen ? (
          <CancelForm pending={pending} fieldError={fieldError} onSubmit={submitHandler} onBack={backHandler} />
        ) : (
          <div className={styles.actions}>
            <Button ref={openButtonRef} variant="danger" onClick={() => setFormOpen(true)}>
              Отмени часа
            </Button>
          </div>
        ))}
    </li>
  );
}
