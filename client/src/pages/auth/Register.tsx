import { useId } from 'react';
import { Link, useNavigate } from 'react-router';
import type { RegisterInput } from '../../api/auth';
import Button from '../../components/button/Button';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import FormField from '../../components/form-field/FormField';
import Sheet from '../../components/sheet/Sheet';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { useFrom } from '../../hooks/useFrom';
import styles from './Auth.module.css';

const CLIENT_FIELDS = ['role', 'name', 'email', 'password'] as const;
// A client's form has no phone field; a manicurist's phone is optional.
const MANICURIST_FIELDS = [...CLIENT_FIELDS, 'phone', 'city', 'address', 'bio'] as const;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const from = useFrom();
  const roleErrorId = useId();

  const { values, changeHandler, submitHandler, pending, formError, fieldErrors } = useForm({
    role: 'CLIENT',
    name: '',
    email: '',
    password: '',
    // Manicurist fields keep their values while hidden, but are sent only while visible.
    phone: '',
    city: '',
    address: '',
    bio: '',
  });

  const isManicurist = values.role === 'MANICURIST';
  const visibleFields = isManicurist ? MANICURIST_FIELDS : CLIENT_FIELDS;

  const registerHandler = async (form: typeof values) => {
    const contact = { name: form.name, email: form.email, password: form.password };
    const input: RegisterInput =
      form.role === 'MANICURIST'
        ? {
            role: 'MANICURIST',
            ...contact,
            phone: form.phone,
            city: form.city,
            address: form.address,
            bio: form.bio,
          }
        : { role: 'CLIENT', ...contact };
    await register(input);
    navigate(from, { replace: true });
  };

  return (
    <Sheet narrow>
      <section className={styles.page}>
        <h1 className={styles.title}>Регистрация</h1>
        {formError && <ErrorMessage message={formError.message} items={formError.items} />}
        <form noValidate className={styles.form} onSubmit={submitHandler(registerHandler, visibleFields)}>
          <p className={styles.requiredNote}>Полетата със * са задължителни.</p>
          <fieldset className={styles.fieldset} aria-describedby={fieldErrors.role ? roleErrorId : undefined}>
            <legend className={styles.legend}>
              Тип профил<span aria-hidden="true">{' *'}</span>
            </legend>
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
            required
            value={values.name}
            onChange={changeHandler}
            error={fieldErrors.name}
          />
          <FormField
            label="Имейл"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={changeHandler}
            error={fieldErrors.email}
          />
          {isManicurist && (
            <FormField
              label="Телефон"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={changeHandler}
              error={fieldErrors.phone}
            />
          )}
          <FormField
            label="Парола"
            name="password"
            type="password"
            autoComplete="new-password"
            required
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
                required
                value={values.city}
                onChange={changeHandler}
                error={fieldErrors.city}
              />
              <FormField
                label="Адрес"
                name="address"
                autoComplete="street-address"
                required
                value={values.address}
                onChange={changeHandler}
                error={fieldErrors.address}
              />
              <FormField
                label="Описание"
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
    </Sheet>
  );
}
