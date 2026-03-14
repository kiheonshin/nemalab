// ============================================================================
// Card Component — Glassmorphism panel
// ============================================================================

import { type HTMLAttributes, type ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'default' | 'compact' | 'flush';
  children: ReactNode;
}

export function Card({
  padding = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    styles.card,
    padding === 'compact' ? styles.compact : '',
    padding === 'flush' ? styles.flush : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
