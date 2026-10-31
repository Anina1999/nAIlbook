import styles from './Backdrop.module.css';

type FlourishProps = {
  /** Where it sits and which way it is mirrored. */
  className: string;
  /** The small dot near the lower end; two of the four flourishes have it. */
  withLowDot?: boolean;
};

/** A thin white flourish with a twinkling star, on the sides of the page. */
function Flourish({ className, withLowDot = false }: FlourishProps) {
  return (
    <svg className={`${styles.flourish} ${className}`} width="36" height="168" viewBox="0 0 60 280">
      <g className={styles.stroke} fill="none" strokeWidth="1.5" strokeLinecap="round">
        <path d="M30 140 C18 120, 16 96, 24 78 C34 56, 38 32, 28 16 C22 6, 12 6, 12 14 C12 22, 20 22, 22 17" />
        <path d="M30 140 C42 160, 44 184, 36 202 C26 224, 22 248, 32 264 C38 274, 48 274, 48 266 C48 258, 40 258, 38 263" />
        <path d="M30 140 C38 132, 44 122, 42 112" />
        <path d="M30 140 C22 148, 16 158, 18 168" />
      </g>
      <g className={styles.fill}>
        <circle cx="30" cy="140" r="2" />
        <circle cx="48" cy="96" r="0.9" />
        <circle cx="10" cy="190" r="0.9" />
        {withLowDot && <circle cx="52" cy="230" r="0.7" />}
        <path
          className={styles.flourishStar}
          d="M46 40 L47.2 46.8 L54 48 L47.2 49.2 L46 56 L44.8 49.2 L38 48 L44.8 46.8 Z"
        />
      </g>
    </svg>
  );
}

/**
 * The night sky behind every page: the cherry-to-indigo gradient with its glows,
 * two layers of glitter, the aurora, the milky way, four flourishes, the rays in
 * the top left corner and the column of stars. Decoration only, hidden from
 * screen readers and from the pointer.
 */
export default function Backdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.glitterA} />
      <div className={styles.glitterB} />
      <div className={styles.aurora} />
      <div className={styles.milky}>
        <div className={styles.milkyGlow} />
        <div className={styles.milkyDust} />
      </div>

      <Flourish className={styles.leftTop} withLowDot />
      <Flourish className={styles.leftBottom} />
      <Flourish className={styles.rightTop} withLowDot />
      <Flourish className={styles.rightBottom} />

      <svg className={styles.rays} width="68" height="68" viewBox="0 0 90 90">
        <g className={styles.stroke} strokeWidth="1" strokeLinecap="round">
          <path d="M45 45 L45 2" />
          <path d="M45 45 L88 45" />
          <path d="M45 45 L76 14" />
          <path d="M45 45 L62 6" />
          <path d="M45 45 L84 28" />
          <path d="M45 45 L84 62" />
          <path d="M45 45 L62 84" />
          <path d="M45 45 L76 76" />
        </g>
      </svg>

      <svg className={styles.starColumn} width="24" height="72" viewBox="0 0 40 120">
        <g className={styles.fill}>
          <circle cx="4" cy="6" r="0.9" />
          <circle cx="36" cy="34" r="1.1" />
          <circle cx="6" cy="72" r="0.8" />
          <circle cx="35" cy="84" r="0.9" />
          <circle cx="8" cy="112" r="1" />
        </g>
        <g className={styles.fill}>
          <path d="M20 2 Q22 18 38 20 Q22 22 20 38 Q18 22 2 20 Q18 18 20 2 Z" />
          <path d="M20 41 Q22 57 38 59 Q22 61 20 77 Q18 61 2 59 Q18 57 20 41 Z" />
          <path d="M20 80 Q22 96 38 98 Q22 100 20 116 Q18 100 2 98 Q18 96 20 80 Z" />
        </g>
      </svg>
    </div>
  );
}
