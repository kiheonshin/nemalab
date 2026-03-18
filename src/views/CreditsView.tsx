import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppCredits } from '../components/common';
import { PageLayout } from '../components/layout';
import styles from './CreditsView.module.css';

const VIEW_KEYS = ['simulator', 'connectome', 'synchrony', 'compare', 'library'] as const;

export function CreditsView() {
  const { t } = useTranslation();

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelector('main')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.querySelector<HTMLElement>(`.${styles.pageContent}`)?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }, []);

  return (
    <PageLayout
      eyebrow={t('nav.credits')}
      title={t('credits.title')}
      contentClassName={styles.pageContent}
    >
      <section className={styles.overviewSection} aria-label={t('credits.title')}>
        <AppCredits className={styles.mobileCreditsTop} variant="plain" />

        <div className={styles.contentSplit}>
          <section
            className={`${styles.infoSection} ${styles.projectSection}`}
            aria-labelledby="credits-project-title"
          >
            <div className={styles.sectionHeader}>
              <h2 id="credits-project-title" className={styles.sectionTitle}>
                {t('credits.projectSectionTitle')}
              </h2>
            </div>

            <div className={styles.heroCopy}>
              <p id="credits-project-copy" className={styles.heroBody}>
                {t('credits.projectBody1')} {t('credits.projectBody2')}
              </p>
            </div>
          </section>

          <section
            className={`${styles.infoSection} ${styles.viewsSection}`}
            aria-labelledby="credits-views-title"
          >
            <div className={styles.sectionHeader}>
              <h2 id="credits-views-title" className={styles.sectionTitle}>
                {t('credits.viewsTitle')}
              </h2>
            </div>

            <div className={styles.viewList}>
              {VIEW_KEYS.map((key) => {
                const body = t(`credits.views.items.${key}.body`).trim();

                return (
                  <article key={key} className={styles.viewItem}>
                    <h3 className={styles.cardTitle}>{t(`credits.views.items.${key}.title`)}</h3>
                    {body ? <p className={styles.cardBody}>{body}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <AppCredits className={styles.desktopCredits} variant="plain" />
      </section>
    </PageLayout>
  );
}
