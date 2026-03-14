// ============================================================================
// Button Component
// Design system button with variant/size/state support.
// ============================================================================

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent';
export type ButtonSize = 'default' | 'small';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Visual state: "ready" shows accent border (dirty), "applied" shows success */
  state?: 'default' | 'ready' | 'applied';
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'default',
  state = 'default',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'small' ? styles.sizeSmall : styles.sizeDefault,
    state === 'ready' ? styles.ready : '',
    state === 'applied' ? styles.applied : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
