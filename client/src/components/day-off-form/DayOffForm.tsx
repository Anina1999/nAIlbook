import type { FormEvent } from 'react';
import { useForm } from '../../hooks/useForm';
import Button from '../button/Button';
import FormField from '../form-field/FormField';
import styles from './DayOffForm.module.css';

type DayOffFormProps = {
  /** True while the day off is being saved: the button is disabled and says «Добавяне…». */
  pending: boolean;
  /** The server's message for the date, shown under the field. */
  fieldError: string | null;
  /** The first and the last date the server accepts (today and the 12-month limit, Sofia). */
  min: string;
  max: string;
  /** Saves the date as typed; resolves to true when it was saved, and the field is cleared. */
  onSubmit: (date: string) => Promise<boolean>;
};

/** The form that marks a date as a day off. The server checks the date. */
export default function DayOffForm({ pending, fieldError, min, max, onSubmit }: DayOffFormProps) {
  const { values, changeHandler, reset } = useForm({ date: '' });

  const submitHandler = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await onSubmit(values.date)) reset();
  };

  return (
    <form noValidate onSubmit={submitHandler} className={styles.form}>
      <div className={styles.field}>
        <FormField
          label="Дата"
          name="date"
          type="date"
          value={values.date}
          onChange={changeHandler}
          error={fieldError ?? undefined}
          min={min}
          max={max}
        />
      </div>
      <Button type="submit" disabled={pending} className={styles.submit}>
        {pending ? 'Добавяне…' : 'Добави'}
      </Button>
    </form>
  );
}
