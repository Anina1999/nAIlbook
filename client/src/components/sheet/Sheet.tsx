import type { ReactNode } from 'react';
import styles from './Sheet.module.css';

type SheetProps = {
  children: ReactNode;
  /** `max-w-xl`, left-aligned, for the forms; otherwise the full column. */
  narrow?: boolean;
};

/** The light surface that carries a working screen on the night backdrop. */
export default function Sheet({ children, narrow = false }: SheetProps) {
  return <div className={[styles.sheet, narrow && styles.narrow].filter(Boolean).join(' ')}>{children}</div>;
}
