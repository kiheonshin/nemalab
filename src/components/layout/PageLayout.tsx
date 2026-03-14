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
  headerVariant?: 'default' | 'minimal';
  hideHeader?: boolean;
}

export function PageLayout({
  title,
  eyebrow,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerVariant = 'default',
  hideHeader = false,
}: PageLayoutProps) {
  const pageClassName = [styles.page, className ?? ''].filter(Boolean).join(' ');
  const contentClassNames = [styles.content, contentClassName ?? ''].filter(Boolean).join(' ');
  const headerClassNames = [
    styles.header,
    headerVariant === 'minimal' ? styles.headerMinimal : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={pageClassName}>
      {!hideHeader ? (
        <header className={headerClassNames}>
          <div className={styles.copy}>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <h1 className={styles.title}>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}

      <div className={contentClassNames}>{children}</div>
    </section>
  );
}
