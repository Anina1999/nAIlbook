import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Booking } from '../../api/bookings';
import { useCancelBooking } from '../../hooks/useCancelBooking';
import { sofiaDateOfIso } from '../../utils/dates';
import { formatCancelledBy, formatLongDate, formatTimeRange } from '../../utils/format';
import Button from '../button/Button';
import CancelForm from '../cancel-form/CancelForm';
import ErrorMessage from '../error-message/ErrorMessage';
import Price from '../price/Price';
import StatusBadge from '../status-badge/StatusBadge';
import styles from './BookingDetails.module.css';

type BookingDetailsProps = {
  /** The active booking. Give the panel `key={booking.id}`, so another booking starts with a closed form. */
  booking: Booking;
  /** Loads the bookings again, after a cancellation or an error that makes the list out of date. */
  onReload: () => void;
};

/**
 * The details of the active upcoming booking: the date, the time, the service and the
 * price, the studio and its phone (only when there is one), and its status. A booking
 * that has not started can be cancelled with a reason; the errors come from the server.
 */
export default function BookingDetails({ booking, onReload }: BookingDetailsProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { cancel, pending, error, fieldError, cancelled, reset } = useCancelBooking(onReload);

  const booked = booking.status === 'BOOKED';
  const started = Date.parse(booking.startAt) <= Date.now();
  // Once cancelled, the button stays away while the list reloads with the new status.
  const canCancel = booked && !started && !cancelled;
  const { manicurist } = booking;

  const submitHandler = async (reason: string) => {
    const done = await cancel(booking.id, reason);
    if (done) {
      setFormOpen(false);
      // The form is gone; the focus goes to the panel, where «Часът е отменен.» is announced.
      titleRef.current?.focus();
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
    <section aria-labelledby={titleId} className={styles.panel}>
      <h3 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
        {formatLongDate(sofiaDateOfIso(booking.startAt))}
      </h3>
      <p className={styles.time}>{formatTimeRange(booking.startAt, booking.endAt)}</p>
      <p className={styles.service}>
        {booking.serviceName}, <Price priceCents={booking.priceCents} />
      </p>
      <div className={styles.studio}>
        <p className={styles.name}>{manicurist.name}</p>
        <p className={styles.place}>
          {manicurist.address}, {manicurist.city}
        </p>
        {/* An empty phone is never shown, label included. */}
        {manicurist.phone && (
          <p className={styles.phone}>
            <span className={styles.phoneLabel}>Телефон</span>{' '}
            <a href={`tel:${manicurist.phone.replace(/\s/g, '')}`} className={styles.link}>
              {manicurist.phone}
            </a>
          </p>
        )}
      </div>

      {booking.status === 'CANCELLED' && (
        <div className={styles.cancelInfo}>
          <StatusBadge label="Отменен" />
          <p>{formatCancelledBy(booking.cancelledBy)}</p>
          {booking.cancelReason && <p className={styles.reason}>Причина: {booking.cancelReason}</p>}
        </div>
      )}

      {booked && started && <p className={styles.note}>Часът вече е започнал и не може да бъде отменен.</p>}

      {/* Always rendered, so the confirmation is announced. */}
      <p role="status" className={styles.success}>
        {cancelled ? 'Часът е отменен.' : ''}
      </p>

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
    </section>
  );
}
