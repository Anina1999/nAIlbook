import type { DayOff } from '../../api/me';
import { formatLongDate } from '../../utils/format';
import Button from '../button/Button';
import styles from './DayOffList.module.css';

type DayOffListProps = {
  /** At least one, soonest first, as the server sends them. */
  daysOff: readonly DayOff[];
  /** The day off being removed: only its button is disabled and says «Премахване…». */
  removingId: number | null;
  onRemove: (id: number) => void;
};

/** The upcoming days off as rows in one container, each with «Премахни». */
export default function DayOffList({ daysOff, removingId, onRemove }: DayOffListProps) {
  return (
    <ul className={styles.list}>
      {daysOff.map((dayOff) => {
        const date = formatLongDate(dayOff.date);
        const removing = removingId === dayOff.id;
        return (
          <li key={dayOff.id} className={styles.row}>
            <span className={styles.date}>{date}</span>
            {/* The name starts with the visible text and adds the date, so the buttons differ when read out. */}
            <Button
              variant="danger"
              aria-label={removing ? undefined : `Премахни ${date}`}
              disabled={removingId !== null}
              onClick={() => onRemove(dayOff.id)}
            >
              {removing ? 'Премахване…' : 'Премахни'}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
