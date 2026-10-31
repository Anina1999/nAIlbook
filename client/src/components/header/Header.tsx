import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
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
        {/* NavLink marks the link with aria-current="page" while the screen is open. */}
        {user.role === 'CLIENT' && (
          <NavLink to="/my-bookings" className={styles.link}>
            Моите часове
          </NavLink>
        )}
        {user.role === 'MANICURIST' && (
          <NavLink to="/days-off" className={styles.link}>
            Почивни дни
          </NavLink>
        )}
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
