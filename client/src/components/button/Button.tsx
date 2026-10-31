import type { ComponentProps } from 'react';
import styles from './Button.module.css';

type ButtonProps = ComponentProps<'button'> & {
  /** `search` is the primary button on the night's glass search panel; `danger` and `dangerSolid` are destructive (the solid one confirms). */
  variant?: 'primary' | 'secondary' | 'search' | 'danger' | 'dangerSolid';
};

export default function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
