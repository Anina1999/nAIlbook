import type { FormEvent } from 'react';
import { useForm } from '../../hooks/useForm';
import Button from '../button/Button';
import FormField from '../form-field/FormField';
import styles from './CancelForm.module.css';

/** The server's limit for a cancel reason (api-conventions). */
const REASON_MAX_LENGTH = 200;

type CancelFormProps = {
  /** True while the cancellation runs: the confirm button is disabled and says «Отменяне…». */
  pending: boolean;
  /** The server's message for `reason`, shown under the field. */
  fieldError: string | null;
  /** Called with the reason as typed: the server trims it and checks its length. */
  onSubmit: (reason: string) => void;
  /** Closes the form; the parent moves the focus back to the button that opened it. */
  onBack: () => void;
};

/**
 * The inline form that cancels a booking with a reason, shown in place of «Отмени часа».
 * Its field takes the focus when it appears; the parent holds `useCancelBooking`.
 */
export default function CancelForm({ pending, fieldError, onSubmit, onBack }: CancelFormProps) {
  const { values, changeHandler } = useForm({ reason: '' });

  const submitHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values.reason);
  };

  return (
    <form noValidate onSubmit={submitHandler} className={styles.form}>
      <FormField
        label="Причина за отмяната"
        name="reason"
        value={values.reason}
        onChange={changeHandler}
        error={fieldError ?? undefined}
        multiline
        maxLength={REASON_MAX_LENGTH}
        autoFocus
      />
      <div className={styles.actions}>
        <Button type="submit" variant="dangerSolid" disabled={pending}>
          {pending ? 'Отменяне…' : 'Потвърди отмяната'}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Назад
        </Button>
      </div>
    </form>
  );
}
