// ============================================================================
// TopBar Layout Component
// Brand + Navigation tabs + Status indicators
// ============================================================================

import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackEvent, EVENTS } from '../../analytics';
import styles from './TopBar.module.css';

const NAV_ITEMS = [
  { key: 'lab', path: '/' },
  { key: 'compare', path: '/compare' },
  { key: 'library', path: '/library' },
  { key: 'saved', path: '/saved' },
  { key: 'settings', path: '/settings' },
] as const;

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>{t('app.title')}</span>
          <span className={styles.brandVersion}>v2.0</span>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/'
                ? currentPath === '/'
                : currentPath === item.path || currentPath.startsWith(item.path + '/');
            return (
              <button
                key={item.key}
                className={`${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}
                onClick={() => {
                  trackEvent(EVENTS.VIEW_CHANGE, { view: item.key });
                  navigate(item.path);
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                {t(`nav.${item.key}`)}
              </button>
            );
          })}
        </nav>

        <div className={styles.status} aria-hidden="true" />
      </div>
    </header>
  );
}
