import styles from './ErrorMessage.module.css';

type ErrorMessageProps = {
  message: string;
  /** Extra messages listed under the main one. */
  items?: string[];
};

export default function ErrorMessage({ message, items = [] }: ErrorMessageProps) {
  return (
    <div role="alert" className={styles.box}>
      <p>{message}</p>
      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
