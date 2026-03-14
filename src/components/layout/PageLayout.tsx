import { type ReactNode } from 'react';
import styles from './PageLayout.module.css';

interface PageLayoutProps {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageLayout({
  title,
  eyebrow,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageLayoutProps) {
  const pageClassName = [styles.page, className ?? ''].filter(Boolean).join(' ');
  const contentClassNames = [styles.content, contentClassName ?? ''].filter(Boolean).join(' ');

  return (
    <section className={pageClassName}>
      <header className={styles.header}>
        <div className={styles.copy}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>

      <div className={contentClassNames}>{children}</div>
    </section>
  );
}
