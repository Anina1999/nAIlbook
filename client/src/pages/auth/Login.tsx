import { Link, useNavigate } from 'react-router';
import Button from '../../components/button/Button';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import FormField from '../../components/form-field/FormField';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { useFrom } from '../../hooks/useFrom';
import styles from './Auth.module.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useFrom();

  const { values, changeHandler, submitHandler, pending, formError, fieldErrors } = useForm({
    email: '',
    password: '',
  });

  const loginHandler = async (input: typeof values) => {
    await login(input);
    navigate(from, { replace: true });
  };

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Вход</h1>
      {formError && <ErrorMessage message={formError.message} items={formError.items} />}
      <form noValidate className={styles.form} onSubmit={submitHandler(loginHandler)}>
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
          label="Парола"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={changeHandler}
          error={fieldErrors.password}
        />
        <div className={styles.actions}>
          <Button type="submit" disabled={pending}>
            {pending ? 'Влизане…' : 'Влез'}
          </Button>
          <Link to="/register" state={{ from }} className={styles.switchLink}>
            Нямате профил? Регистрация
          </Link>
        </div>
      </form>
    </section>
  );
}
