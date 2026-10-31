import { Link } from 'react-router';
import type { ManicuristSummary } from '../../api/manicurists';
import { formatDuration, initials } from '../../utils/format';
import Price from '../price/Price';
import styles from './ManicuristCard.module.css';

/** A card shows this many services; the page lists them all. */
const SHOWN_SERVICES = 3;

/** «и още 1 услуга», «и още 4 услуги». */
function moreServicesText(count: number): string {
  return count === 1 ? 'и още 1 услуга' : `и още ${count} услуги`;
}

type ManicuristCardProps = {
  manicurist: ManicuristSummary;
  /** The active card of the search (its marker is the active one): a light runs round its border. */
  active: boolean;
  /** A click anywhere on the card makes it the active card; a click on the active card keeps it. */
  onActivate: (id: number) => void;
  /** Hover or focus on the card reports its id, and `null` when it ends, so its marker stands out. */
  onHighlight: (id: number | null) => void;
};

function PinIcon() {
  return (
    <svg
      className={styles.pin}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/**
 * A search result on an iridescent card. The card selects, it does not open a page: the
 * name is a button (`aria-pressed` on the active card) stretched over the whole card, so a
 * click anywhere makes it the active card, while the button's name stays the name alone.
 * Hover and focus report the card through `onHighlight`. «Запази час» is a link above the
 * button and the only way to the manicurist's page, at the free times.
 */
export default function ManicuristCard({ manicurist, active, onActivate, onHighlight }: ManicuristCardProps) {
  const page = `/manicurists/${manicurist.id}`;
  const shown = manicurist.services.slice(0, SHOWN_SERVICES);
  const hidden = manicurist.services.length - shown.length;
  const highlightHandler = () => onHighlight(manicurist.id);
  const unhighlightHandler = () => onHighlight(null);

  return (
    // Focus bubbles in React, so the button and the link both report the card.
    <article
      className={[styles.card, active && styles.active].filter(Boolean).join(' ')}
      onMouseEnter={highlightHandler}
      onMouseLeave={unhighlightHandler}
      onFocus={highlightHandler}
      onBlur={unhighlightHandler}
    >
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(manicurist.name)}
        </span>
        <div className={styles.identity}>
          <h3 className={styles.name}>
            <button
              type="button"
              aria-pressed={active}
              className={styles.select}
              onClick={() => onActivate(manicurist.id)}
            >
              {manicurist.name}
            </button>
          </h3>
          <p className={styles.city}>
            <PinIcon />
            {manicurist.city}
          </p>
        </div>
      </div>

      <div className={styles.divider} aria-hidden="true">
        <span className={styles.lineIn} />
        <svg className={styles.dividerStar} width="14" height="14" viewBox="0 0 24 24">
          <path d="M12 1 Q13 11 23 12 Q13 13 12 23 Q11 13 1 12 Q11 11 12 1 Z" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <span className={styles.lineOut} />
      </div>

      {/* flex-1 keeps «Запази час» at the bottom of the equally tall cards. */}
      <div className={styles.services}>
        {shown.length > 0 && (
          <ul className={styles.serviceList}>
            {shown.map((service) => (
              <li key={service.id} className={styles.service}>
                <span className={styles.serviceName}>{service.name}</span>{' '}
                <span className={styles.meta}>
                  <span className={styles.price}>
                    <Price priceCents={service.priceCents} />
                  </span>{' '}
                  <span className={styles.duration}>{formatDuration(service.durationMin)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && <p className={styles.more}>{moreServicesText(hidden)}</p>}
      </div>

      <Link to={`${page}#schedule`} className={styles.book} aria-label={`Запази час при ${manicurist.name}`}>
        Запази час
      </Link>
    </article>
  );
}
