import Logo from '../logo/Logo';
import styles from './Footer.module.css';

/** Three small four-point stars in a row. */
function Stars({ late = false }: { late?: boolean }) {
  return (
    <svg className={`${styles.stars} ${late ? styles.late : ''}`} width="33" height="9" viewBox="0 0 44 12">
      <g className={styles.fill}>
        <path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z" />
        <path d="M22 0 L23.2 4.8 L28 6 L23.2 7.2 L22 12 L20.8 7.2 L16 6 L20.8 4.8 Z" />
        <path d="M38 0 L39.2 4.8 L44 6 L39.2 7.2 L38 12 L36.8 7.2 L32 6 L36.8 4.8 Z" />
      </g>
    </svg>
  );
}

/** The ornament row (decoration only) and the footer with the logo and the copyright line. */
export default function Footer() {
  return (
    <>
      <div className={styles.ornament} aria-hidden="true">
        <Stars />
        <svg className={styles.flourish} width="200" height="26" viewBox="0 0 260 34">
          <g className={styles.stroke} fill="none" strokeWidth="1.4" strokeLinecap="round">
            <path d="M130 20 C118 8, 98 6, 82 14 C64 23, 40 27, 22 18 C10 12, 8 2, 18 2 C26 2, 28 10, 22 13" />
            <path d="M130 20 C142 8, 162 6, 178 14 C196 23, 220 27, 238 18 C250 12, 252 2, 242 2 C234 2, 232 10, 238 13" />
            <path d="M130 20 C122 26, 108 28, 96 25" />
            <path d="M130 20 C138 26, 152 28, 164 25" />
          </g>
          <g className={styles.fill}>
            <circle cx="130" cy="20" r="1.8" />
            <circle cx="60" cy="10" r="0.9" />
            <circle cx="200" cy="10" r="0.9" />
            <circle cx="104" cy="31" r="0.7" />
            <circle cx="156" cy="31" r="0.7" />
          </g>
        </svg>
        <Stars late />
      </div>

      <footer className={styles.footer}>
        <div className={styles.inner}>
          <Logo size="footer" />
          {/* The one place where parts are joined with « · » (ui-design, Components, Footer). */}
          <p className={styles.line}>© 2026 Анина Ангелова. Всички права запазени.</p>
        </div>
      </footer>
    </>
  );
}
