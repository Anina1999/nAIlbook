import type { FormEvent } from 'react';
import { useForm } from '../../hooks/useForm';
import Button from '../button/Button';
import FormField from '../form-field/FormField';
import styles from './SearchForm.module.css';

export type SearchValues = {
  city: string;
  service: string;
};

type SearchFormProps = {
  /** The values the inputs start with. Remount the form (a `key`) to show new ones. */
  initialValues: SearchValues;
  onSearch: (values: SearchValues) => void;
};

/** City and service search on the glass panel. It searches only on submit, never while typing. */
export default function SearchForm({ initialValues, onSearch }: SearchFormProps) {
  const { values, changeHandler } = useForm<SearchValues>(initialValues);

  const submitHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(values);
  };

  return (
    <form role="search" noValidate className={styles.form} onSubmit={submitHandler}>
      <div className={styles.field}>
        <FormField
          variant="glass"
          label="Град"
          name="city"
          autoComplete="address-level2"
          placeholder="напр. София"
          value={values.city}
          onChange={changeHandler}
        />
      </div>
      <div className={styles.field}>
        <FormField
          variant="glass"
          label="Услуга"
          name="service"
          autoComplete="off"
          placeholder="напр. Гел лак"
          value={values.service}
          onChange={changeHandler}
        />
      </div>
      <Button type="submit" variant="search" className={styles.submit}>
        Търсене
      </Button>
    </form>
  );
}
