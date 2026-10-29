import { Link } from 'react-router';
import type { ManicuristSummary } from '../../api/manicurists';
import { formatDuration } from '../../utils/format';
import Price from '../price/Price';
import styles from './ManicuristCard.module.css';

type ManicuristCardProps = {
  manicurist: ManicuristSummary;
};

/**
 * A search result. The name link is stretched over the whole card, so a click
 * anywhere opens the manicurist's page, while the link's name stays the name alone.
 */
export default function ManicuristCard({ manicurist }: ManicuristCardProps) {
  return (
    <article className={styles.card}>
      <h2 className={styles.name}>
        <Link to={`/manicurists/${manicurist.id}`} className={styles.link}>
          {manicurist.name}
        </Link>
      </h2>
      <p className={styles.city}>{manicurist.city}</p>
      {manicurist.services.length > 0 && (
        <ul className={styles.services}>
          {manicurist.services.map((service) => (
            <li key={service.id} className={styles.service}>
              <span className={styles.serviceName}>{service.name}</span>
              <span className={styles.meta}>
                <Price priceCents={service.priceCents} />
                <span className={styles.duration}>{formatDuration(service.durationMin)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
