import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, UNEXPECTED_ERROR_MESSAGE, validationDetails } from '../api/client';

type Values = Record<string, string>;

/** The error box above the form: the server's message and any field issues with no visible field. */
export type FormError = { message: string; items: string[] };

export function useForm<V extends Values>(initialValues: V) {
  const [values, setValues] = useState<V>(initialValues);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof V, string>>>({});

  const changeHandler = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Wraps onSubmit for a form's onSubmit. `visibleFields` are the fields shown
   * right now (default: every field in `values`); a VALIDATION_ERROR detail for
   * any other path goes into the error box.
   */
  const submitHandler =
    (onSubmit: (values: V) => Promise<void>, visibleFields: readonly (keyof V)[] = Object.keys(values)) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;

      setPending(true);
      setFormError(null);
      setFieldErrors({});

      try {
        await onSubmit(values);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          setFormError({ message: UNEXPECTED_ERROR_MESSAGE, items: [] });
          return;
        }
        const nextFieldErrors: Partial<Record<keyof V, string>> = {};
        const items: string[] = [];
        for (const detail of validationDetails(error)) {
          if (visibleFields.includes(detail.path) && !nextFieldErrors[detail.path as keyof V]) {
            nextFieldErrors[detail.path as keyof V] = detail.message;
          } else if (!visibleFields.includes(detail.path)) {
            items.push(detail.message);
          }
        }
        setFieldErrors(nextFieldErrors);
        setFormError({ message: error.message, items });
      } finally {
        setPending(false);
      }
    };

  /** Puts the initial values back, after a submit that should leave an empty form. */
  const reset = () => setValues(initialValues);

  return { values, changeHandler, submitHandler, pending, formError, fieldErrors, reset };
}
