// ============================================================================
// SettingsView - User preferences
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/common';
import { PageLayout } from '../components/layout';
import { trackEvent, EVENTS } from '../analytics';
import { deepClone, timeLabel } from '../engine/math';
import { useStore } from '../store';
import styles from './SettingsView.module.css';

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const updateSetting = useStore((s) => s.updateSetting);
  const savedRuns = useStore((s) => s.savedRuns);
  const loadSavedRuns = useStore((s) => s.loadSavedRuns);
  const deleteRun = useStore((s) => s.deleteRun);
  const clearAllRuns = useStore((s) => s.clearAllRuns);
  const createSimulation = useStore((s) => s.createSimulation);
  const showToast = useStore((s) => s.showToast);
  const isKorean = i18n.language.startsWith('ko');
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  const languageOptions = useMemo(
    () => [
      { value: 'ko' as const, label: t('settings.languageOptionKorean') },
      { value: 'en' as const, label: t('settings.languageOptionEnglish') },
    ],
    [t],
  );

  const hints = isKorean
    ? {
        language: '탐색과 제어 전반에 표시되는 인터페이스 언어를 선택합니다.',
        highContrast: '카드, 경계선, 초점 상태의 대비를 높여 더 선명하게 보여줍니다.',
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

  useEffect(() => {
    loadSavedRuns();
  }, [loadSavedRuns]);

  useEffect(() => {
    if (!languageOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) {
        setLanguageOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [languageOpen]);

  const currentLanguageLabel =
    languageOptions.find((option) => option.value === settings.language)?.label ?? settings.language;
  const toggleSettings = [
    {
      key: 'highContrast' as const,
      label: t('settings.highContrast'),
      hint: hints.highContrast,
      checked: settings.highContrast,
    },
    {
      key: 'reducedMotion' as const,
      label: t('settings.reducedMotion'),
      hint: hints.reducedMotion,
      checked: settings.reducedMotion,
    },
    {
      key: 'showOnboarding' as const,
      label: t('settings.showOnboarding'),
      hint: hints.onboarding,
      checked: settings.showOnboarding,
    },
  ];

  const handleLoad = (run: typeof savedRuns[number]) => {
    useStore.setState({
      appliedConfig: deepClone(run.config),
      draftConfig: deepClone(run.config),
      appliedSeed: run.seed,
      draftSeed: run.seed,
      dirtyPaths: new Set<string>(),
      visualDirtyPaths: new Set<string>(),
    });
    createSimulation(run.config, run.seed);
    showToast(t('toast.loaded'));
    navigate('/simulator');
  };

  const handleDelete = (id: string) => {
    deleteRun(id);
    showToast(t('toast.deleted'));
  };

  return (
    <PageLayout
      eyebrow={t('nav.settings')}
      title={t('settings.title')}
      contentClassName={styles.pageContent}
    >
      <section className={styles.sectionPanel} aria-labelledby="settings-preferences-title">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <h2 id="settings-preferences-title" className={styles.sectionTitle}>
              {t('settings.preferencesTitle')}
            </h2>
          </div>
        </div>

        <div className={styles.settingsGrid}>
          <Card
            padding="default"
            className={`${styles.settingCard} ${languageOpen ? styles.settingCardOverlay : ''}`}
          >
            <div className={styles.settingCardTop}>
              <div className={styles.settingCopy}>
                <div className={styles.settingLabel}>{t('settings.language')}</div>
                <p className={styles.settingHint}>{hints.language}</p>
              </div>

              <div className={styles.settingValueArea}>
                <div className={styles.selectWrap} ref={languageRef}>
                  <button
                    type="button"
                    className={styles.select}
                    aria-haspopup="listbox"
                    aria-expanded={languageOpen}
                    onClick={() => setLanguageOpen((open) => !open)}
                  >
                    <span>{currentLanguageLabel}</span>
                    <span className={styles.selectChevron} aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {languageOpen ? (
                    <div
                      className={styles.selectMenu}
                      role="listbox"
                      aria-label={t('settings.language')}
                    >
                      {languageOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={settings.language === option.value}
                          className={`${styles.selectOption} ${
                            settings.language === option.value ? styles.selectOptionActive : ''
                          }`}
                          onClick={() => {
                            handleLanguageChange(option.value);
                            setLanguageOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          {toggleSettings.map((item) => (
            <Card key={item.key} padding="default" className={styles.settingCard}>
              <label className={styles.toggleField}>
                <div className={styles.settingCopy}>
                  <div className={styles.settingLabelRow}>
                    <div className={styles.settingLabel}>{item.label}</div>
                    <span
                      className={`${styles.settingState} ${
                        item.checked ? styles.settingStateActive : styles.settingStateIdle
                      }`}
                    >
                      {item.checked ? t('settings.enabled') : t('settings.disabled')}
                    </span>
                  </div>
                  <p className={styles.settingHint}>{item.hint}</p>
                </div>

                <span className={styles.toggleWrap}>
                  <span className={styles.switchShell}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => updateSetting(item.key, e.target.checked)}
                      className={styles.switchInput}
                    />
                    <span className={styles.switchTrack}>
                      <span className={styles.switchThumb} />
                    </span>
                  </span>
                </span>
              </label>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.sectionPanel} aria-labelledby="settings-saved-title">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <h2 id="settings-saved-title" className={styles.sectionTitle}>
              {t('saved.title')}
            </h2>
          </div>

          {savedRuns.length > 0 ? (
            <Button variant="secondary" size="small" onClick={clearAllRuns}>
              {t('saved.clearAll')}
            </Button>
          ) : null}
        </div>

        {savedRuns.length === 0 ? (
          <Card className={styles.emptyState}>
            <div className={styles.emptyStateBody}>
              <h3 className={styles.emptyStateTitle}>{t('saved.empty')}</h3>
              <p className={styles.emptyStateHint}>{t('saved.emptyHint')}</p>
            </div>
          </Card>
        ) : (
          <div className={styles.savedGrid}>
            {savedRuns.map((run) => (
              <Card key={run.id} padding="compact" className={styles.savedCard}>
                <div className={styles.savedCardBody}>
                  <div className={styles.savedCardHeader}>
                    <div className={styles.savedHeaderBlock}>
                      <span className={styles.savedPresetLabel}>{run.config.presetName || 'Lab'}</span>
                    </div>
                    <p className={styles.savedMeta}>
                      {new Date(run.createdAt).toLocaleString(isKorean ? 'ko-KR' : 'en-US')}
                    </p>
                  </div>

                  <div className={styles.savedSummaryList}>
                    <div className={styles.savedSummaryRow}>
                      <span className={styles.savedSummaryLabel}>{t('saved.presetLabel')}</span>
                      <span className={styles.savedSummaryValue}>{run.config.presetName}</span>
                    </div>
                    {run.metrics ? (
                      <>
                        <div className={styles.savedSummaryRow}>
                          <span className={styles.savedSummaryLabel}>{t('monitor.elapsed')}</span>
                          <span className={styles.savedSummaryValue}>
                            {timeLabel(run.metrics.elapsed)}
                          </span>
                        </div>
                        <div className={styles.savedSummaryRow}>
                          <span className={styles.savedSummaryLabel}>{t('monitor.collisions')}</span>
                          <span className={styles.savedSummaryValue}>{run.metrics.collisions}</span>
                        </div>
                        <div className={styles.savedSummaryRow}>
                          <span className={styles.savedSummaryLabel}>{t('monitor.turns')}</span>
                          <span className={styles.savedSummaryValue}>{run.metrics.turns}</span>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className={styles.savedActions}>
                    <Button size="small" variant="primary" onClick={() => handleLoad(run)}>
                      {t('saved.load')}
                    </Button>
                    <Button size="small" variant="ghost" onClick={() => handleDelete(run.id)}>
                      {t('saved.delete')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
