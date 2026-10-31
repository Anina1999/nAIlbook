import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getMyBookings, type Booking } from '../../api/bookings';
import BookingDetails from '../../components/booking-details/BookingDetails';
import BookingList from '../../components/booking-list/BookingList';
import BookingWeek from '../../components/booking-week/BookingWeek';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import Loader from '../../components/loader/Loader';
import Sheet from '../../components/sheet/Sheet';
import StudioMap, { type StudioMarker } from '../../components/studio-map/StudioMap';
import { useAsync } from '../../hooks/useAsync';
import { useMyBookingsWeek } from '../../hooks/useMyBookingsWeek';
import { todayInSofia, weekOfIso } from '../../utils/dates';
import styles from './MyBookings.module.css';

export default function MyBookings() {
  const upcomingTitleId = useId();
  const pastTitleId = useId();
  // Bumped after a cancellation or a cancel error, so the list loads again.
  const [reloadCount, setReloadCount] = useState(0);
  const { data, error } = useAsync((signal) => getMyBookings(signal), [reloadCount]);

  const today = todayInSofia();
  const { week, firstWeek, lastWeek, selectWeek } = useMyBookingsWeek(data?.upcoming ?? null, today);

  const reloadHandler = () => {
    // Keeps the shown week: without `?week` a cancellation could move the default week
    // (the soonest BOOKED booking) away from the booking that was just cancelled.
    selectWeek(week);
    setReloadCount((count) => count + 1);
  };

  if (!data) {
    return <Sheet>{error ? <ErrorMessage message={error} /> : <Loader />}</Sheet>;
  }

  const hasNone = data.upcoming.length === 0 && data.past.length === 0;

  return (
    <Sheet>
      <div className={styles.page}>
        <h1 className={styles.title}>Моите часове</h1>
        {/* A failed reload: the list loaded before stays under it. */}
        {error && <ErrorMessage message={error} />}

        {hasNone ? (
          <div className={styles.empty}>
            <p>Още нямате запазени часове.</p>
            <Link to="/" className={styles.link}>
              Към търсенето
            </Link>
          </div>
        ) : (
          <>
            <section aria-labelledby={upcomingTitleId} className={styles.section}>
              <h2 id={upcomingTitleId} className={styles.sectionTitle}>
                Предстоящи
              </h2>
              {data.upcoming.length === 0 ? (
                <p className={styles.note}>Нямате предстоящи часове.</p>
              ) : (
                // The key starts the active booking and the map again for every week.
                <UpcomingWeek
                  key={week}
                  week={week}
                  firstWeek={firstWeek}
                  lastWeek={lastWeek}
                  onWeekChange={selectWeek}
                  upcoming={data.upcoming}
                  onReload={reloadHandler}
                />
              )}
            </section>

            <section aria-labelledby={pastTitleId} className={styles.section}>
              <h2 id={pastTitleId} className={styles.sectionTitle}>
                Минали
              </h2>
              {data.past.length === 0 ? (
                <p className={styles.note}>Нямате минали часове.</p>
              ) : (
                <BookingList bookings={data.past} />
              )}
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}

type UpcomingWeekProps = {
  week: string;
  firstWeek: string;
  lastWeek: string;
  onWeekChange: (monday: string) => void;
  /** Every upcoming booking, soonest first; the week's are picked here. */
  upcoming: readonly Booking[];
  onReload: () => void;
};

/** One studio per manicurist, in the order of the week's bookings. */
function studiosOf(bookings: readonly Booking[]): StudioMarker[] {
  const studios = new Map<number, StudioMarker>();
  for (const { manicurist } of bookings) {
    if (!studios.has(manicurist.id)) {
      const { id, name, latitude, longitude } = manicurist;
      studios.set(id, { id, name, latitude, longitude });
    }
  }
  return [...studios.values()];
}

/**
 * The shown week: the board, the details of the active booking and the map of the
 * week's studios. It holds the active booking (the week's first at the start) and the
 * map's `zoomRequest`; give it `key={week}`, so a new week starts again at its first
 * booking with every studio in view.
 */
function UpcomingWeek({ week, firstWeek, lastWeek, onWeekChange, upcoming, onReload }: UpcomingWeekProps) {
  const bookings = upcoming.filter((booking) => weekOfIso(booking.startAt) === week);
  const [activeId, setActiveId] = useState<number | null>(bookings[0]?.id ?? null);
  // Bumped on every choice of the user, so the map flies to the chosen studio; 0 keeps
  // the view of all the week's studios at the start.
  const [zoomRequest, setZoomRequest] = useState(0);
  // A booking that left the week (it ended while the page was open) gives way to the first.
  const active = bookings.find((booking) => booking.id === activeId) ?? bookings[0] ?? null;

  // The same studios give the same array, also after a reload brings new booking
  // objects, so the map does not draw its markers again and keeps its view.
  const studiosKey = JSON.stringify(studiosOf(bookings));
  const studios = useMemo(() => JSON.parse(studiosKey) as StudioMarker[], [studiosKey]);

  const chooseHandler = (id: number) => {
    setActiveId(id);
    setZoomRequest((count) => count + 1);
  };

  // A marker stands for a studio: its first booking of the week becomes active.
  const markerSelectHandler = (manicuristId: number) => {
    const first = bookings.find((booking) => booking.manicurist.id === manicuristId);
    if (first) chooseHandler(first.id);
  };

  return (
    <div className={styles.upcoming}>
      <BookingWeek
        week={week}
        firstWeek={firstWeek}
        lastWeek={lastWeek}
        onWeekChange={onWeekChange}
        bookings={bookings}
        activeId={active?.id ?? null}
        onSelect={chooseHandler}
      />
      {active && (
        <div className={styles.selection}>
          <div className={styles.details}>
            {/* The key closes the cancel form when another booking becomes active. */}
            <BookingDetails key={active.id} booking={active} onReload={onReload} />
          </div>
          {/* The frame sets the map's height, radius and border; the map fills it. */}
          <div className={styles.mapFrame}>
            <StudioMap
              markers={studios}
              activeId={active.manicurist.id}
              onMarkerSelect={markerSelectHandler}
              zoomRequest={zoomRequest}
              label="Карта на студиата"
            />
          </div>
        </div>
      )}
    </div>
  );
}
