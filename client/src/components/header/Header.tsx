import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../logo/Logo';
import styles from './Header.module.css';

export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const logoutHandler = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    navigate('/');
  };

  let menu;
  if (loading) {
    menu = <span className={styles.status}>Зареждане…</span>;
  } else if (user) {
    menu = (
      <>
        <span className={styles.userName}>{user.name}</span>
        <button type="button" className={styles.outline} onClick={logoutHandler} disabled={loggingOut}>
          {loggingOut ? 'Излизане…' : 'Изход'}
        </button>
      </>
    );
  } else {
    menu = (
      <>
        <Link to="/login" className={styles.link}>
          Вход
        </Link>
        <Link to="/register" className={styles.outline}>
          Регистрация
        </Link>
      </>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo />
        <nav aria-label="Основно меню" className={styles.nav}>
          {menu}
        </nav>
      </div>
    </header>
  );
}
