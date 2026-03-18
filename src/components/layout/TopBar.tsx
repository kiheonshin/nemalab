// ============================================================================
// TopBar Layout Component
// Brand + Navigation tabs + Status indicators
// ============================================================================

import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackEvent, EVENTS } from '../../analytics';
import styles from './TopBar.module.css';

const PRIMARY_NAV_ITEMS = [
  { key: 'lab', path: '/simulator' },
  { key: 'connectome', path: '/connectome', fallbackLabel: 'Connectome' },
  { key: 'synchrony', path: '/synchrony', fallbackLabel: 'Synchrony' },
  { key: 'compare', path: '/compare' },
  { key: 'library', path: '/library' },
  { key: 'settings', path: '/settings' },
] as const;

const CREDIT_NAV_ITEM = { key: 'credits', path: '/credits', fallbackLabel: 'Credit' } as const;
const DESKTOP_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, CREDIT_NAV_ITEM] as const;

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const isPathActive = (path: string) =>
    path === '/simulator' ? currentPath === '/simulator' : currentPath === path || currentPath.startsWith(path + '/');

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <div className={styles.mobileHeaderRow}>
          <div className={styles.brand}>
            <span className={styles.brandTitle}>{t('app.title')}</span>
            <span className={styles.brandVersion}>v2.1</span>
          </div>

          <button
            className={`${styles.mobileCreditBtn} ${isPathActive(CREDIT_NAV_ITEM.path) ? styles.mobileCreditBtnActive : ''}`}
            onClick={() => {
              trackEvent(EVENTS.VIEW_CHANGE, { view: CREDIT_NAV_ITEM.key });
              navigate(CREDIT_NAV_ITEM.path);
            }}
            aria-current={isPathActive(CREDIT_NAV_ITEM.path) ? 'page' : undefined}
          >
            {t('nav.credits', { defaultValue: CREDIT_NAV_ITEM.fallbackLabel })}
          </button>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const isActive = isPathActive(item.path);
            return (
              <button
                key={item.key}
                className={`${styles.navBtn} ${item.key === 'credits' ? styles.navBtnCreditMobileHidden : ''} ${isActive ? styles.navBtnActive : ''}`}
                onClick={() => {
                  trackEvent(EVENTS.VIEW_CHANGE, { view: item.key });
                  navigate(item.path);
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                {'fallbackLabel' in item
                  ? t(`nav.${item.key}`, { defaultValue: item.fallbackLabel })
                  : t(`nav.${item.key}`)}
              </button>
            );
          })}
        </nav>

        <div className={styles.status} aria-hidden="true" />
      </div>
    </header>
  );
}
