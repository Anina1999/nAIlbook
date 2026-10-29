import { useId } from 'react';
import { Link, useNavigate } from 'react-router';
import type { RegisterInput } from '../../api/auth';
import Button from '../../components/button/Button';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import FormField from '../../components/form-field/FormField';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { useFrom } from '../../hooks/useFrom';
import styles from './Auth.module.css';

const CONTACT_FIELDS = ['role', 'name', 'email', 'phone', 'password'] as const;
const PROFILE_FIELDS = ['city', 'address', 'bio'] as const;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const from = useFrom();
  const roleErrorId = useId();

  const { values, changeHandler, submitHandler, pending, formError, fieldErrors } = useForm({
    role: 'CLIENT',
    name: '',
    email: '',
    phone: '',
    password: '',
    // Manicurist fields keep their values while hidden, but are sent only while visible.
    city: '',
    address: '',
    bio: '',
  });

  const isManicurist = values.role === 'MANICURIST';
  const visibleFields = isManicurist ? [...CONTACT_FIELDS, ...PROFILE_FIELDS] : CONTACT_FIELDS;

  const registerHandler = async (form: typeof values) => {
    const contact = { name: form.name, email: form.email, phone: form.phone, password: form.password };
    const input: RegisterInput =
      form.role === 'MANICURIST'
        ? { role: 'MANICURIST', ...contact, city: form.city, address: form.address, bio: form.bio }
        : { role: 'CLIENT', ...contact };
    await register(input);
    navigate(from, { replace: true });
  };

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Регистрация</h1>
      {formError && <ErrorMessage message={formError.message} items={formError.items} />}
      <form noValidate className={styles.form} onSubmit={submitHandler(registerHandler, visibleFields)}>
        <fieldset className={styles.fieldset} aria-describedby={fieldErrors.role ? roleErrorId : undefined}>
          <legend className={styles.legend}>Тип профил</legend>
          <div className={styles.options}>
            <label className={styles.option}>
              <input
                type="radio"
                name="role"
                value="CLIENT"
                checked={values.role === 'CLIENT'}
                onChange={changeHandler}
                className={styles.radio}
              />
              Клиент
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="role"
                value="MANICURIST"
                checked={isManicurist}
                onChange={changeHandler}
                className={styles.radio}
              />
              Маникюрист
            </label>
          </div>
          {fieldErrors.role && (
            <p id={roleErrorId} className={styles.fieldError}>
              {fieldErrors.role}
            </p>
          )}
        </fieldset>
        <FormField
          label="Име"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={changeHandler}
          error={fieldErrors.name}
        />
        <FormField
          label="Имейл"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={changeHandler}
          error={fieldErrors.email}
        />
        <FormField
          label="Телефон"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={changeHandler}
          error={fieldErrors.phone}
        />
        <FormField
          label="Парола"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={changeHandler}
          error={fieldErrors.password}
        />
        {isManicurist && (
          <>
            <FormField
              label="Град"
              name="city"
              autoComplete="address-level2"
              value={values.city}
              onChange={changeHandler}
              error={fieldErrors.city}
            />
            <FormField
              label="Адрес"
              name="address"
              autoComplete="street-address"
              value={values.address}
              onChange={changeHandler}
              error={fieldErrors.address}
            />
            <FormField
              label="Описание (по желание)"
              name="bio"
              multiline
              value={values.bio}
              onChange={changeHandler}
              error={fieldErrors.bio}
            />
          </>
        )}
        <div className={styles.actions}>
          <Button type="submit" disabled={pending}>
            {pending ? 'Регистриране…' : 'Регистрирай се'}
          </Button>
          <Link to="/login" state={{ from }} className={styles.switchLink}>
            Имате профил? Вход
          </Link>
        </div>
      </form>
    </section>
  );
}
