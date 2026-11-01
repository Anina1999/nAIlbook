import { useId, useRef, useState, type RefObject } from 'react';
import { getSchedule, type Booking } from '../../api/bookings';
import ConnectionError from '../../components/connection-error/ConnectionError';
import DayPicker from '../../components/day-picker/DayPicker';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import Loader from '../../components/loader/Loader';
import ScheduleBooking from '../../components/schedule-booking/ScheduleBooking';
import Sheet from '../../components/sheet/Sheet';
import { useAsync } from '../../hooks/useAsync';
import { useScheduleDate } from '../../hooks/useScheduleDate';
import styles from './Schedule.module.css';

export default function Schedule() {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { date, lastDate, selectDate } = useScheduleDate();
  // Bumped after a cancellation or a cancel error, so the day loads again.
  const [reloadCount, setReloadCount] = useState(0);
  const { data, error, loading, offline } = useAsync((signal) => getSchedule(date, signal), [date, reloadCount]);

  const reloadHandler = () => setReloadCount((count) => count + 1);

  // The server could not be reached: only the message and «Зареди отново», even over an earlier result.
  if (offline) return <ConnectionError />;

  // useAsync keeps the previous result while a new day loads: never show another day's
  // bookings under this day's title. A reload of the same day keeps its list.
  const day = data && data.date === date ? data : null;

  let content;
  if (day) {
    content = (
      // The key starts the status line again for every day.
      <ScheduleDay key={date} bookings={day.bookings} error={error} titleRef={titleRef} onReload={reloadHandler} />
    );
  } else if (error && !loading) {
    content = <ErrorMessage message={error} />;
  } else {
    content = <Loader />;
  }

  return (
    <Sheet>
      <div className={styles.page}>
        <h1 className={styles.title}>Моят график</h1>
        <section aria-labelledby={titleId} className={styles.day}>
          <DayPicker date={date} lastDate={lastDate} onChange={selectDate} titleId={titleId} titleRef={titleRef} />
          {content}
        </section>
      </div>
    </Sheet>
  );
}

type ScheduleDayProps = {
  /** The day's bookings by start time, cancelled ones included. */
  bookings: readonly Booking[];
  /** A failed reload: the list loaded before stays under it. */
  error: string | null;
  /** The day's heading, where the focus goes after a cancellation. */
  titleRef: RefObject<HTMLHeadingElement | null>;
  onReload: () => void;
};

/**
 * The bookings of the shown day, with the status line that announces a cancellation.
 * Give it `key={date}`, so another day starts with an empty status.
 */
function ScheduleDay({ bookings, error, titleRef, onReload }: ScheduleDayProps) {
  const [status, setStatus] = useState('');

  // The reload itself comes from `useCancelBooking`, which calls `onReload` after a cancellation.
  const cancelledHandler = () => {
    setStatus('Часът е отменен.');
    // The form is gone; the focus goes to the day's heading, next to the announcement.
    titleRef.current?.focus();
  };

  return (
    <div className={styles.bookings}>
      {error && <ErrorMessage message={error} />}
      {/* Always rendered, so a cancellation is announced. */}
      <p role="status" className={styles.success}>
        {status}
      </p>
      {bookings.length === 0 ? (
        <p className={styles.note}>Нямате часове на тази дата.</p>
      ) : (
        <ul className={styles.list}>
          {bookings.map((booking) => (
            <ScheduleBooking key={booking.id} booking={booking} onCancelled={cancelledHandler} onReload={onReload} />
          ))}
        </ul>
      )}
    </div>
  );
}
