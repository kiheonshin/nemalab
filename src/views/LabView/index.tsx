// ============================================================================
// LabView — Main 3-column simulation view
// Left: ConfigPanel | Center: SimulationCanvas + RunBar (overlaid) | Right: MonitorPanel
// ============================================================================

import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackEvent, EVENTS } from '../../analytics';
import { useStore } from '../../store';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { ConfigPanel } from './ConfigPanel';
import { SimulationCanvas } from './SimulationCanvas';
import { RunBar } from './RunBar';
import { MonitorPanel } from './MonitorPanel';
import { LEGEND_ITEMS } from '../../engine/constants';
import styles from '../LabView.module.css';

const AHA_STORAGE_KEY = 'nema-lab-aha-moment-v1';

export function LabView() {
  const { t } = useTranslation();
  const appliedConfig = useStore((s) => s.appliedConfig);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const simInstance = useStore((s) => s.simInstance);
  const simRunning = useStore((s) => s.simRunning);
  const snapshot = useStore((s) => s.snapshot);
  const createSimulation = useStore((s) => s.createSimulation);
  const stepSimulation = useStore((s) => s.stepSimulation);
  const resetRun = useStore((s) => s.resetRun);
  const resetSimulation = useStore((s) => s.resetSimulation);
  const showToast = useStore((s) => s.showToast);
  const loadSettings = useStore((s) => s.loadSettings);
  const loadSavedRuns = useStore((s) => s.loadSavedRuns);
  const [running, setRunning] = useState(true);
  const [timeScale, setTimeScale] = useState(1);

  const handleStep = useCallback(() => {
    setRunning(false);
    stepSimulation(1 / 60);
  }, [stepSimulation]);

  const handleResetRun = useCallback(() => {
    trackEvent(EVENTS.SIM_RESET);
    resetRun();
    resetSimulation();
    showToast(t('toast.runReset'));
  }, [resetRun, resetSimulation, showToast, t]);

  // Keyboard shortcuts (Space / S / R)
  useKeyboardShortcuts({
    running,
    setRunning,
    onStep: handleStep,
    onReset: handleResetRun,
  });

  // Track whether this is first mount
  const mountedRef = useRef(false);
  const ahaTrackedRef = useRef(false);

  // Load persisted state on mount
  useEffect(() => {
    loadSettings();
    loadSavedRuns();
  }, [loadSettings, loadSavedRuns]);

  useEffect(() => {
    try {
      ahaTrackedRef.current = sessionStorage.getItem(AHA_STORAGE_KEY) === '1';
    } catch {
      ahaTrackedRef.current = false;
    }
  }, []);

  // Create sim on mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      createSimulation(appliedConfig, appliedSeed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recreate sim when appliedConfig or appliedSeed changes (after mount)
  useEffect(() => {
    if (mountedRef.current && simInstance) {
      simInstance.setConfig(appliedConfig, true);
      if (simInstance.getSeed() !== appliedSeed) {
        simInstance.setSeed(appliedSeed);
      }
      useStore.getState().updateSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedConfig, appliedSeed]);

  // Animation loop
  const onFrame = useCallback(
    (dt: number) => {
      const scaledDt = dt * timeScale;
      const fixedStep = 1 / 60;
      let remaining = scaledDt;
      while (remaining > fixedStep) {
        stepSimulation(fixedStep);
        remaining -= fixedStep;
      }
      if (remaining > 0) {
        stepSimulation(remaining);
      }
    },
    [stepSimulation, timeScale],
  );

  useAnimationFrame(onFrame, running && simRunning && simInstance !== null);

  useEffect(() => {
    if (ahaTrackedRef.current || !snapshot) return;

    const { elapsed, distance, eventCount, foodTime } = snapshot.metrics;
    const reachedAha = elapsed >= 10 && distance >= 80 && (eventCount >= 1 || foodTime >= 1);

    if (!reachedAha) return;

    ahaTrackedRef.current = true;

    try {
      sessionStorage.setItem(AHA_STORAGE_KEY, '1');
    } catch {
      // Ignore storage issues.
    }

    trackEvent(EVENTS.AHA_MOMENT_REACHED, {
      elapsed_seconds: Math.round(elapsed),
      distance: Math.round(distance),
      event_count: eventCount,
      preset_name: appliedConfig.presetName || 'custom',
    });
  }, [snapshot, appliedConfig.presetName]);

  return (
    <div className={styles.labLayout}>
      <aside className={styles.leftRail}>
        <ConfigPanel />
      </aside>

      <div className={styles.center}>
        <div className={styles.canvasWrapper}>
          <SimulationCanvas />
          {/* Legend overlay inside renderer */}
          <div className={styles.legendOverlay}>
            {LEGEND_ITEMS.map((item) => (
              <span key={item.label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          {/* Controls overlay inside renderer */}
          <RunBar
            running={running}
            timeScale={timeScale}
            onToggleRunning={() => setRunning(!running)}
            onStep={handleStep}
            onResetRun={handleResetRun}
            onTimeScaleChange={setTimeScale}
          />
        </div>
      </div>

      <aside className={styles.rightRail}>
        <MonitorPanel />
      </aside>
    </div>
  );
}
