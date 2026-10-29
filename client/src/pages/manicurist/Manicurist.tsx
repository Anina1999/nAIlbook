import { useId, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { User } from '../../api/auth';
import { ApiError } from '../../api/client';
import { getManicurist, type Manicurist, type Service } from '../../api/manicurists';
import Button from '../../components/button/Button';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import Loader from '../../components/loader/Loader';
import Price from '../../components/price/Price';
import WeekSchedule from '../../components/week-schedule/WeekSchedule';
import { useAsync, type AsyncState } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import { useBookingParams } from '../../hooks/useBookingParams';
import { useBookSlot } from '../../hooks/useBookSlot';
import { useWeekSlots, type WeekSlots } from '../../hooks/useWeekSlots';
import { lastBookableDate, sofiaDateOf, todayInSofia } from '../../utils/dates';
import { formatDuration, formatLongDate, formatTime } from '../../utils/format';
import styles from './Manicurist.module.css';

/** The profile, or null when there is no such manicurist (404 or an id that is not a number). */
type ProfileResult = { manicurist: Manicurist | null };

function parseId(value: string | undefined): number | null {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export default function ManicuristPage() {
  const { id } = useParams();
  const manicuristId = parseId(id);
  const descriptionId = useId();

  const profile = useAsync<ProfileResult>(
    (signal) =>
      manicuristId === null
        ? Promise.resolve({ manicurist: null })
        : getManicurist(manicuristId, signal).catch((error: unknown) => {
            // A 404 is a state of the page, not an error box.
            if (error instanceof ApiError && error.status === 404) return { manicurist: null };
            throw error;
          }),
    [manicuristId],
  );
  const manicurist = profile.data?.manicurist ?? null;

  // The bookable window, today to the 12-month limit, both in Sofia.
  const today = todayInSofia();
  const last = lastBookableDate(today);
  const { serviceId, week, firstWeek, lastWeek, selectService, selectWeek } = useBookingParams(
    manicurist,
    today,
    last,
  );
  const service = manicurist?.services.find((s) => s.id === serviceId) ?? null;

  // Bumped after a booking or a 409, so the week loads again.
  const [reloadCount, setReloadCount] = useState(0);
  const weekSlots = useWeekSlots({ manicurist, service, week, today, last, reloadCount });

  if (profile.error) return <ErrorMessage message={profile.error} />;
  if (!profile.data) return <Loader />;

  if (!manicurist) {
    return (
      <div className={styles.empty}>
        <p>Маникюристът не е намерен.</p>
        <Link to="/" className={styles.link}>
          Към търсенето
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.profile}>
        <h1 className={styles.title}>{manicurist.name}</h1>
        <p className={styles.place}>
          {manicurist.city}, {manicurist.address}
        </p>
        <dl className={styles.contacts}>
          <div className={styles.contact}>
            <dt className={styles.contactLabel}>Имейл</dt>
            <dd className={styles.contactValue}>
              <a href={`mailto:${manicurist.email}`} className={styles.link}>
                {manicurist.email}
              </a>
            </dd>
          </div>
          {/* An empty phone is never shown, label included. */}
          {manicurist.phone && (
            <div className={styles.contact}>
              <dt className={styles.contactLabel}>Телефон</dt>
              <dd className={styles.contactValue}>
                <a href={`tel:${manicurist.phone.replace(/\s/g, '')}`} className={styles.link}>
                  {manicurist.phone}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {manicurist.bio && <p className={styles.bio}>{manicurist.bio}</p>}
      </section>

      {manicurist.services.length === 0 ? (
        <p className={styles.empty}>Все още няма добавени услуги.</p>
      ) : (
        <fieldset className={styles.fieldset}>
          <legend className={styles.stepTitle}>Изберете услуга</legend>
          <div className={styles.options}>
            {manicurist.services.map((s) => (
              <label key={s.id} className={styles.option}>
                <input
                  type="radio"
                  name="service"
                  value={s.id}
                  checked={s.id === serviceId}
                  onChange={() => selectService(s.id)}
                  aria-describedby={s.description ? `${descriptionId}-${s.id}` : undefined}
                  className={styles.radio}
                />
                {/* The spaces keep the parts apart in the radio's accessible name. */}
                <span className={styles.optionText}>
                  <span className={styles.optionMain}>
                    <span className={styles.serviceName}>{s.name}</span>{' '}
                    <span className={styles.serviceMeta}>
                      <Price priceCents={s.priceCents} />{' '}
                      <span className={styles.duration}>{formatDuration(s.durationMin)}</span>
                    </span>
                  </span>
                  {s.description && (
                    <span id={`${descriptionId}-${s.id}`} className={styles.description}>
                      {s.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* The key resets the chosen time, the confirmation and the error for a new service or week. */}
      {service && (
        <BookingStep
          key={`${service.id}-${week}`}
          manicurist={manicurist}
          service={service}
          week={week}
          firstWeek={firstWeek}
          lastWeek={lastWeek}
          onWeekChange={selectWeek}
          weekSlots={weekSlots}
          onReload={() => setReloadCount((count) => count + 1)}
        />
      )}
    </div>
  );
}

type BookingStepProps = {
  manicurist: Manicurist;
  service: Service;
  week: string;
  firstWeek: string;
  lastWeek: string;
  onWeekChange: (monday: string) => void;
  /** Loaded by the page, so the previous week stays on screen while a new one loads. */
  weekSlots: AsyncState<WeekSlots | null>;
  onReload: () => void;
};

/** The week table of the chosen service, the summary and «Запази час». */
function BookingStep({
  manicurist,
  service,
  week,
  firstWeek,
  lastWeek,
  onWeekChange,
  weekSlots,
  onReload,
}: BookingStepProps) {
  const titleId = useId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The chosen time is local: it is picked again after a reload or a return from login.
  const [chosen, setChosen] = useState<{ date: string; slot: string } | null>(null);

  const reloadHandler = () => {
    setChosen(null);
    onReload();
  };
  const { book, pending, error, booked, reset } = useBookSlot(reloadHandler);

  // Only a time the server still offers in the week on screen can be booked.
  const data = weekSlots.data;
  const isCurrent = data !== null && data.week === week && data.serviceId === service.id;
  const selected = chosen && isCurrent && data.days[chosen.date]?.slots.includes(chosen.slot) ? chosen : null;

  const selectHandler = (date: string, slot: string) => {
    if (!isCurrent) return; // the previous week, still shown while the new one loads
    setChosen({ date, slot });
    reset();
  };

  const bookHandler = () => {
    if (!selected) return;
    if (!user) {
      // Login returns to `from`, so the same service and week come back; the time is picked again.
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    void book({ manicuristId: manicurist.id, serviceId: service.id, startAt: selected.slot });
  };

  return (
    <section className={styles.step} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.stepTitle}>
        Свободни часове
      </h2>
      <WeekSchedule
        week={week}
        firstWeek={firstWeek}
        lastWeek={lastWeek}
        onWeekChange={onWeekChange}
        workingHours={manicurist.workingHours}
        data={data}
        loading={weekSlots.loading}
        error={weekSlots.error}
        selected={selected?.slot ?? null}
        onSelect={selectHandler}
      />

      {error && <ErrorMessage message={error} />}

      <div role="status" className={styles.success}>
        {booked && (
          <>
            <p className={styles.successTitle}>Часът е запазен.</p>
            <p>
              {booked.serviceName}, {formatLongDate(sofiaDateOf(new Date(booked.startAt)))} в{' '}
              {formatTime(booked.startAt)}.
            </p>
          </>
        )}
      </div>

      {selected && (
        <div className={styles.summary}>
          <p className={styles.summaryText}>
            {service.name}, {formatLongDate(selected.date)}, {formatTime(selected.slot)},{' '}
            <Price priceCents={service.priceCents} />
          </p>
          <BookAction user={user} pending={pending} onBook={bookHandler} />
        </div>
      )}
    </section>
  );
}

type BookActionProps = {
  user: User | null;
  pending: boolean;
  onBook: () => void;
};

/** «Запази час» for a client or a guest; a manicurist cannot book. */
function BookAction({ user, pending, onBook }: BookActionProps) {
  if (user && user.role !== 'CLIENT') {
    return <p className={styles.note}>Само клиенти могат да запазват час.</p>;
  }
  return (
    <Button onClick={onBook} disabled={pending}>
      {pending ? 'Запазване…' : 'Запази час'}
    </Button>
  );
}
