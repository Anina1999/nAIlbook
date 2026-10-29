import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import Button from '../button/Button';
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
        <Button variant="secondary" onClick={logoutHandler} disabled={loggingOut}>
          {loggingOut ? 'Излизане…' : 'Изход'}
        </Button>
      </>
    );
  } else {
    menu = (
      <>
        <Link to="/login" className={styles.link}>
          Вход
        </Link>
        <Link to="/register" className={styles.link}>
          Регистрация
        </Link>
      </>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          nAIlbook
        </Link>
        <nav aria-label="Основно меню" className={styles.nav}>
          {menu}
        </nav>
      </div>
    </header>
  );
}
