import styles from './Loader.module.css';

export default function Loader() {
  return (
    <p role="status" className={styles.loader}>
      Зареждане…
    </p>
  );
}
