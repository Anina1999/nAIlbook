import { Link } from 'react-router';
import styles from './NotFound.module.css';

/** The 404 page: every path no route matches, on the night with no sheet, in the middle of `main`. */
export default function NotFound() {
  return (
    <div className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Страницата не е намерена</h1>
      <p className={styles.note}>Адресът може да е сгрешен или страницата вече не съществува.</p>
      <Link to="/" className={styles.link}>
        Към началната страница
      </Link>
    </div>
  );
}
