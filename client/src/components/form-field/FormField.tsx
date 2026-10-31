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
  /** An example of a value («напр. София»); never the label. */
  placeholder?: string;
  /** Renders a textarea instead of an input. */
  multiline?: boolean;
  /** Marks the field as required: ` *` after the label and `aria-required` on the control. */
  required?: boolean;
  /** `glass` is the field on the night's glass search panel: a white label with a shadow, a 44px input. */
  variant?: 'sheet' | 'glass';
};

export default function FormField({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  placeholder,
  multiline = false,
  required = false,
  variant = 'sheet',
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const glass = variant === 'glass';
  const shared = {
    id,
    name,
    value,
    onChange,
    autoComplete,
    placeholder,
    'aria-required': required ? true : undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };
  const inputClass = [styles.input, glass && styles.glassInput].filter(Boolean).join(' ');

  return (
    <div className={[styles.field, glass && styles.glassField].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={[styles.label, glass && styles.glassLabel].filter(Boolean).join(' ')}>
        {label}
        {required && <span aria-hidden="true">{' *'}</span>}
      </label>
      {multiline ? (
        <textarea {...shared} rows={4} className={`${inputClass} ${styles.textarea}`} />
      ) : (
        <input {...shared} type={type} className={inputClass} />
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
