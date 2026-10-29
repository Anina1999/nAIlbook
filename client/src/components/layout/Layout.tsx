import { Outlet } from 'react-router';
import Header from '../header/Header';
import styles from './Layout.module.css';

export default function Layout() {
  return (
    <>
      <Header />
      <main className={styles.column}>
        <Outlet />
      </main>
    </>
  );
}
