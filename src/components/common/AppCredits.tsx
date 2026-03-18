import styles from './AppCredits.module.css';

interface AppCreditsProps {
  className?: string;
  variant?: 'default' | 'plain';
}

export function AppCredits({ className, variant = 'default' }: AppCreditsProps) {
  const rootClassName = [
    styles.credits,
    variant === 'plain' ? styles.plain : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      <p className={styles.linePrimary}>A Research-Based Nematodes Sensorimotor Simulator</p>
      <p className={styles.lineSecondary}>
        {'by Kiheon Shin \u00B7 Nema Lab Demo v2.1 \u00B7 Non-Commercial'}
      </p>
      <a className={styles.link} href="mailto:heavenlydesigner@gmail.com">
        heavenlydesigner@gmail.com
      </a>
    </div>
  );
}
