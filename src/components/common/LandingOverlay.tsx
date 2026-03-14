// ============================================================================
// LandingOverlay — First-visit onboarding overlay
// Glassmorphism card with CTA to start or browse presets.
// ============================================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { trackEvent, EVENTS } from '../../analytics';
import styles from './LandingOverlay.module.css';

const VISITED_KEY = 'nema-lab-visited';

/** Returns true when the user has already dismissed the overlay. */
export function hasVisited(): boolean {
  try {
    return localStorage.getItem(VISITED_KEY) === '1';
  } catch {
    return false;
  }
}

function markVisited(): void {
  try {
    localStorage.setItem(VISITED_KEY, '1');
  } catch {
    // Storage may be unavailable — silently ignore.
  }
}

export function LandingOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const createSimulation = useStore((s) => s.createSimulation);
  const appliedConfig = useStore((s) => s.appliedConfig);
  const appliedSeed = useStore((s) => s.appliedSeed);

  const dismiss = useCallback(() => {
    markVisited();
    setVisible(false);
  }, []);

  const handleStartNow = useCallback(() => {
    trackEvent(EVENTS.LANDING_CTA_CLICK, { cta: 'start_now' });
    createSimulation(appliedConfig, appliedSeed);
    dismiss();
    navigate('/');
  }, [createSimulation, appliedConfig, appliedSeed, dismiss, navigate]);

  const handleBrowsePresets = useCallback(() => {
    trackEvent(EVENTS.LANDING_CTA_CLICK, { cta: 'browse_presets' });
    dismiss();
    navigate('/library');
  }, [dismiss, navigate]);

  if (!visible) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('landing.title')}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('landing.title')}</h1>
        <p className={styles.subtitle}>{t('landing.subtitle')}</p>
        <p className={styles.description}>{t('landing.description')}</p>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleStartNow}>
            {t('landing.startNow')}
          </button>
          <button className={styles.secondaryBtn} onClick={handleBrowsePresets}>
            {t('landing.browsePresets')}
          </button>
        </div>
      </div>
    </div>
  );
}
