import styles from './StatusBadge.module.css';

type StatusBadgeProps = {
  /** The word that carries the status, never colour alone: «Отменен». */
  label: string;
  /** `inverse` on a filled background (a selected booking button). */
  tone?: 'default' | 'inverse';
};

/** The status of a booking as a small pill (ui-design, Components, Status badge). */
export default function StatusBadge({ label, tone = 'default' }: StatusBadgeProps) {
  return <span className={[styles.badge, tone === 'inverse' && styles.inverse].filter(Boolean).join(' ')}>{label}</span>;
}
