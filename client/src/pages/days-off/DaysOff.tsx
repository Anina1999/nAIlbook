import { useId, useRef, useState } from 'react';
import { getMyDaysOff } from '../../api/me';
import DayOffConflict from '../../components/day-off-conflict/DayOffConflict';
import DayOffForm from '../../components/day-off-form/DayOffForm';
import DayOffList from '../../components/day-off-list/DayOffList';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import Loader from '../../components/loader/Loader';
import Sheet from '../../components/sheet/Sheet';
import { useAsync } from '../../hooks/useAsync';
import { useMarkDayOff } from '../../hooks/useMarkDayOff';
import { useRemoveDayOff } from '../../hooks/useRemoveDayOff';
import { lastBookableDate, todayInSofia } from '../../utils/dates';
import styles from './DaysOff.module.css';

export default function DaysOff() {
  const listTitleId = useId();
  const formTitleId = useId();
  const listTitleRef = useRef<HTMLHeadingElement>(null);
  // Bumped after a day off is added or removed, so the list loads again.
  const [reloadCount, setReloadCount] = useState(0);
  const { data, error } = useAsync((signal) => getMyDaysOff(signal), [reloadCount]);

  const reloadHandler = () => setReloadCount((count) => count + 1);
  const marking = useMarkDayOff(reloadHandler);
  const removing = useRemoveDayOff(reloadHandler);

  // The dates the server accepts (api-conventions, POST /api/me/days-off).
  const today = todayInSofia();
  const lastDate = lastBookableDate(today);

  const removeHandler = async (id: number) => {
    // The row and its button go away with the reload; the focus waits on the list's heading.
    if (await removing.remove(id)) listTitleRef.current?.focus();
  };

  if (!data) {
    return <Sheet>{error ? <ErrorMessage message={error} /> : <Loader />}</Sheet>;
  }

  return (
    <Sheet>
      <div className={styles.page}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Почивни дни</h1>
          <p className={styles.note}>В почивен ден клиентите не могат да запазват часове.</p>
        </div>
        {/* A failed reload: the list loaded before stays under it. */}
        {error && <ErrorMessage message={error} />}

        <section aria-labelledby={listTitleId} className={styles.section}>
          <h2 id={listTitleId} ref={listTitleRef} tabIndex={-1} className={styles.sectionTitle}>
            Предстоящи почивни дни
          </h2>
          {removing.error && <ErrorMessage message={removing.error} />}
          {/* Always rendered, so the removal is announced. */}
          <p role="status" className={styles.success}>
            {removing.removed ? 'Почивният ден е премахнат.' : ''}
          </p>
          {data.daysOff.length === 0 ? (
            <p className={styles.note}>Нямате планирани почивни дни.</p>
          ) : (
            <DayOffList daysOff={data.daysOff} removingId={removing.removingId} onRemove={removeHandler} />
          )}
        </section>

        <section aria-labelledby={formTitleId} className={styles.section}>
          <h2 id={formTitleId} className={styles.sectionTitle}>
            Добави почивен ден
          </h2>
          {marking.error && <ErrorMessage message={marking.error} />}
          <DayOffForm
            pending={marking.pending}
            fieldError={marking.fieldError}
            min={today}
            max={lastDate}
            onSubmit={marking.mark}
          />
          {/* Always rendered, so the new day off is announced. */}
          <p role="status" className={styles.success}>
            {marking.added ? 'Почивният ден е добавен.' : ''}
          </p>
          {marking.conflict && (
            <DayOffConflict conflict={marking.conflict} onBookingCancelled={marking.dropConflictBooking} />
          )}
        </section>
      </div>
    </Sheet>
  );
}
