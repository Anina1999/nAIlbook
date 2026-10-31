import type { ChangeEvent, Ref } from 'react';
import { addDays, isIsoDate } from '../../utils/dates';
import { formatLongDate } from '../../utils/format';
import FormField from '../form-field/FormField';
import styles from './DayPicker.module.css';

type DayPickerProps = {
  /** The shown Sofia date, `YYYY-MM-DD`. */
  date: string;
  /** The last date that can be chosen (the 12-month limit): «Следващ ден» stops here. */
  lastDate: string;
  onChange: (date: string) => void;
  /** The id and the ref of the day's heading, so the page can name a section by it and focus it. */
  titleId?: string;
  titleRef?: Ref<HTMLHeadingElement>;
};

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className={styles.icon}>
      <path
        d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Chooses one day: the day's title between «Предишен ден» and «Следващ ден» (a bar like
 * the week navigation), and a date field to jump to any day. There is no lower bound;
 * the upper one is `lastDate`. A field value that is empty, not a date or after
 * `lastDate` is ignored, so the shown day stays.
 */
export default function DayPicker({ date, lastDate, onChange, titleId, titleRef }: DayPickerProps) {
  const fieldChangeHandler = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    // `YYYY-MM-DD` strings compare in calendar order.
    if (isIsoDate(value) && value <= lastDate) onChange(value);
  };

  return (
    <div className={styles.picker}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Предишен ден"
          onClick={() => onChange(addDays(date, -1))}
        >
          <ChevronIcon direction="left" />
        </button>
        {/* Announced when the day changes; focused after a cancellation. */}
        <h2 id={titleId} ref={titleRef} tabIndex={-1} aria-live="polite" className={styles.title}>
          {formatLongDate(date)}
        </h2>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Следващ ден"
          disabled={date >= lastDate}
          onClick={() => onChange(addDays(date, 1))}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
      <div className={styles.field}>
        <FormField label="Дата" name="date" type="date" value={date} onChange={fieldChangeHandler} max={lastDate} />
      </div>
    </div>
  );
}
