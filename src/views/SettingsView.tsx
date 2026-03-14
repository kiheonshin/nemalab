// ============================================================================
// SettingsView - User preferences
// ============================================================================

import { useTranslation } from 'react-i18next';
import { Card } from '../components/common';
import { PageLayout } from '../components/layout';
import { useStore } from '../store';
import { trackEvent, EVENTS } from '../analytics';
import styles from './SettingsView.module.css';

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const isKorean = i18n.language.startsWith('ko');

  const hints = isKorean
    ? {
        language: '탐색과 제어 전반에 표시되는 인터페이스 언어를 선택합니다.',
        highContrast: '카드, 경계선, 포커스 상태의 대비를 높여 더 또렷하게 보여줍니다.',
        reducedMotion: '장면 전환과 강조 애니메이션을 줄여 더 차분한 흐름으로 표시합니다.',
        onboarding: 'Lab으로 돌아왔을 때 빠른 시작 안내를 다시 보여줍니다.',
      }
    : {
        language: 'Choose the interface language used across navigation and controls.',
        highContrast: 'Increase contrast for cards, edges, and focus states.',
        reducedMotion: 'Tone down transitions and animated emphasis across the app.',
        onboarding: 'Show the quick-start overlay again when returning to the lab.',
      };

  const handleLanguageChange = (lang: 'ko' | 'en') => {
    trackEvent(EVENTS.LANGUAGE_SWITCH, { language: lang });
    updateSetting('language', lang);
    i18n.changeLanguage(lang);
  };

  return (
    <PageLayout
      eyebrow={t('nav.settings')}
      title={t('settings.title')}
      contentClassName={styles.pageContent}
    >
      <div className={styles.grid}>
        <Card padding="default" className={styles.settingCard}>
          <div className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>{t('settings.language')}</div>
              <p className={styles.settingHint}>{hints.language}</p>
            </div>
            <select
              value={settings.language}
              onChange={(e) => handleLanguageChange(e.target.value as 'ko' | 'en')}
              className={styles.select}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </div>
        </Card>

        <Card padding="default" className={styles.settingCard}>
          <label className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>{t('settings.highContrast')}</div>
              <p className={styles.settingHint}>{hints.highContrast}</p>
            </div>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => updateSetting('highContrast', e.target.checked)}
              className={styles.toggle}
            />
          </label>
        </Card>

        <Card padding="default" className={styles.settingCard}>
          <label className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>{t('settings.reducedMotion')}</div>
              <p className={styles.settingHint}>{hints.reducedMotion}</p>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
              className={styles.toggle}
            />
          </label>
        </Card>

        <Card padding="default" className={styles.settingCard}>
          <label className={styles.settingRow}>
            <div>
              <div className={styles.settingLabel}>{t('settings.showOnboarding')}</div>
              <p className={styles.settingHint}>{hints.onboarding}</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showOnboarding}
              onChange={(e) => updateSetting('showOnboarding', e.target.checked)}
              className={styles.toggle}
            />
          </label>
        </Card>
      </div>
    </PageLayout>
  );
}
