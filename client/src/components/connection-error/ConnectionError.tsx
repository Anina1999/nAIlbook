import { NETWORK_ERROR_MESSAGE } from '../../api/client';
import Button from '../button/Button';
import styles from './ConnectionError.module.css';

/**
 * The server-down page: a screen whose load could not reach the server shows only this,
 * on the night with no sheet, in the middle of `main`. «Зареди отново» reloads the whole
 * page, so `/me` and the screen's load both run again.
 */
export default function ConnectionError() {
  return (
    <div className={styles.page}>
      <p role="alert" className={styles.message}>
        {NETWORK_ERROR_MESSAGE}
      </p>
      <Button variant="search" onClick={() => window.location.reload()}>
        Зареди отново
      </Button>
    </div>
  );
}
