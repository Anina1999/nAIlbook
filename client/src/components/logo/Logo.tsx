import { useId } from 'react';
import { Link } from 'react-router';
import styles from './Logo.module.css';

type LogoProps = {
  /** `header` is 24px, `footer` 18px. */
  size?: 'header' | 'footer';
};

/**
 * The n[AI]lbook logotype with the polish bottle, a link to `/`. The page shows it
 * twice (header and footer), so the SVG gradient ids come from useId.
 */
export default function Logo({ size = 'header' }: LogoProps) {
  // An id that is safe inside url(#…), whatever characters useId uses.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const capId = `${id}-cap`;
  const polishId = `${id}-polish`;

  return (
    <Link to="/" aria-label="nAIlbook — начало" className={`${styles.logo} ${styles[size]}`}>
      <span className={styles.letters}>n</span>
      <span className={styles.tag}>
        <span className={styles.glitter} aria-hidden="true" />
        <span className={styles.tagText}>AI</span>
        <svg className={styles.bottle} viewBox="0 0 40 40" aria-hidden="true">
          <defs>
            <linearGradient id={capId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" className={styles.cap1} />
              <stop offset="0.35" className={styles.cap2} />
              <stop offset="0.55" className={styles.cap3} />
              <stop offset="1" className={styles.cap4} />
            </linearGradient>
            <linearGradient id={polishId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className={styles.polish1} />
              <stop offset="0.45" className={styles.polish2} />
              <stop offset="0.6" className={styles.polish3} />
              <stop offset="1" className={styles.polish4} />
            </linearGradient>
          </defs>
          <g transform="rotate(40 20 20)">
            <rect x="14.5" y="-6" width="11" height="18.5" rx="2.6" fill={`url(#${capId})`} />
            <g className={styles.capRidges} strokeWidth="0.6">
              <path d="M17.4 -4.5 V11" />
              <path d="M20 -4.5 V11" />
              <path d="M22.6 -4.5 V11" />
            </g>
            <rect x="15.6" y="-4.6" width="1.1" height="15" rx="0.55" className={styles.capShine} />
            <rect x="14" y="11.6" width="12" height="2.8" rx="1" className={styles.collar} />
            <rect x="19" y="14.4" width="2" height="5.4" className={styles.neck} />
            <path
              d="M18.4 19.6 L21.6 19.6 C23.6 24 24.9 28.6 24.8 33.2 Q24.7 35.6 22.4 35.8 L17.6 35.8 Q15.3 35.6 15.2 33.2 C15.1 28.6 16.4 24 18.4 19.6 Z"
              fill={`url(#${polishId})`}
              className={styles.bottleEdge}
              strokeWidth="0.7"
              strokeLinejoin="round"
            />
            <g className={styles.streaks} strokeWidth="0.45" strokeLinecap="round" fill="none">
              <path d="M19.2 21 Q18 28 17.4 35.2" />
              <path d="M20 21 V35.2" />
              <path d="M20.8 21 Q22 28 22.6 35.2" />
            </g>
            <path
              d="M18.6 24 Q17.6 28.5 17.3 32"
              fill="none"
              className={styles.shine}
              strokeWidth="0.7"
              strokeLinecap="round"
            />
            <path d="M20 35.8 Q21.6 38.4 20 39.4 Q18.4 38.4 20 35.8 Z" className={styles.drop} strokeWidth="0.4" />
          </g>
        </svg>
      </span>
      <span className={styles.letters}>lbook</span>
    </Link>
  );
}
