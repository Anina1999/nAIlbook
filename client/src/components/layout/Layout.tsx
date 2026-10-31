import { Outlet } from 'react-router';
import Backdrop from '../backdrop/Backdrop';
import Footer from '../footer/Footer';
import Header from '../header/Header';
import styles from './Layout.module.css';

/** Every page: the night backdrop, the header, the 1280px column and the footer. */
export default function Layout() {
  return (
    <div className={styles.app}>
      <Backdrop />
      <div className={styles.content}>
        <Header />
        <main className={styles.column}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
