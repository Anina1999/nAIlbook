import { useId, type ChangeEvent, type HTMLInputTypeAttribute } from 'react';
import styles from './FormField.module.css';

type FormFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  /** Renders a textarea instead of an input. */
  multiline?: boolean;
};

export default function FormField({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  multiline = false,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const shared = {
    id,
    name,
    value,
    onChange,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={4} className={`${styles.input} ${styles.textarea}`} />
      ) : (
        <input {...shared} type={type} className={styles.input} />
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
