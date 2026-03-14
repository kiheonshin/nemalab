// ============================================================================
// RunBar - Compact playback toolbox inside the simulation canvas
// ============================================================================

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store';
import { trackEvent, EVENTS } from '../../analytics';
import styles from '../LabView.module.css';

function IconPlay() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 4.5L15 10L6 15.5V4.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="5" y="4.5" width="3.5" height="11" rx="1" fill="currentColor" />
      <rect x="11.5" y="4.5" width="3.5" height="11" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconStep() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4" y="4.5" width="2.5" height="11" rx="1" fill="currentColor" />
      <path d="M8 4.5L16 10L8 15.5V4.5Z" fill="currentColor" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M6.3 7.1A5.4 5.4 0 1110 15.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.6 3.8V7.5H10.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSave() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 4.5H13.5L15.5 6.5V15.5H5V4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 4.5H12V8H7V4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7 12.2H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTrack() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

function ToolButton({
  label,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.toolButton} ${active ? styles.toolButtonActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.toolButtonIcon}>{icon}</span>
      <span className={styles.toolButtonLabel}>{label}</span>
    </button>
  );
}

export function RunBar() {
  const { t } = useTranslation();
  const running = useStore((s) => s.running);
  const timeScale = useStore((s) => s.timeScale);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const appliedConfig = useStore((s) => s.appliedConfig);
  const snapshot = useStore((s) => s.snapshot);
  const setRunning = useStore((s) => s.setRunning);
  const setTimeScale = useStore((s) => s.setTimeScale);
  const resetRun = useStore((s) => s.resetRun);
  const resetSimulation = useStore((s) => s.resetSimulation);
  const stepSimulation = useStore((s) => s.stepSimulation);
  const trackingMode = useStore((s) => s.trackingMode);
  const setTrackingMode = useStore((s) => s.setTrackingMode);
  const saveRun = useStore((s) => s.saveRun);
  const showToast = useStore((s) => s.showToast);

  const handlePlayPause = () => {
    trackEvent(running ? EVENTS.SIM_PAUSE : EVENTS.SIM_START);
    setRunning(!running);
  };

  const handleStep = () => {
    setRunning(false);
    stepSimulation(1 / 60);
  };

  const handleResetRun = () => {
    trackEvent(EVENTS.SIM_RESET);
    resetRun();
    resetSimulation();
    showToast(t('toast.runReset'));
  };

  const handleSave = () => {
    const name = new Date().toLocaleString();
    saveRun(name, appliedConfig, appliedSeed, snapshot?.metrics ?? null);
    showToast(t('toast.saved'));
  };

  return (
    <div className={styles.runBarOverlay}>
      <div className={styles.runToolbox}>
        <div className={styles.runToolGroup}>
          <ToolButton
            label={running ? t('lab.pause') : t('lab.play')}
            icon={running ? <IconPause /> : <IconPlay />}
            active={running}
            onClick={handlePlayPause}
          />
          <ToolButton label={t('lab.step')} icon={<IconStep />} onClick={handleStep} />
          <ToolButton label={t('lab.resetRun')} icon={<IconReset />} onClick={handleResetRun} />
          <ToolButton label={t('lab.save')} icon={<IconSave />} onClick={handleSave} />
          <ToolButton
            label={t('lab.tracking')}
            icon={<IconTrack />}
            active={trackingMode}
            onClick={() => setTrackingMode(!trackingMode)}
          />
        </div>

        <div className={styles.speedField}>
          <div className={styles.speedFieldBody}>
            <div className={styles.speedSliderRow}>
              <span className={styles.speedScaleValue}>0.5x</span>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={timeScale}
                onChange={(e) => setTimeScale(Number(e.target.value))}
                className={styles.toolboxSpeedSlider}
                aria-label={t('lab.timeScale')}
              />
              <span className={styles.speedScaleValue}>4x</span>
            </div>
            <span className={styles.toolButtonLabel}>{t('lab.timeScale')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
