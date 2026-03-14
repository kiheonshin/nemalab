// ============================================================================
// LabView — Main 3-column simulation view
// Left: ConfigPanel | Center: SimulationCanvas + RunBar (overlaid) | Right: MonitorPanel
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { ConfigPanel } from './ConfigPanel';
import { SimulationCanvas } from './SimulationCanvas';
import { RunBar } from './RunBar';
import { MonitorPanel } from './MonitorPanel';
import { LEGEND_ITEMS } from '../../engine/constants';
import styles from '../LabView.module.css';

export function LabView() {
  const appliedConfig = useStore((s) => s.appliedConfig);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const running = useStore((s) => s.running);
  const timeScale = useStore((s) => s.timeScale);
  const simInstance = useStore((s) => s.simInstance);
  const simRunning = useStore((s) => s.simRunning);
  const createSimulation = useStore((s) => s.createSimulation);
  const stepSimulation = useStore((s) => s.stepSimulation);
  const loadSettings = useStore((s) => s.loadSettings);
  const loadSavedRuns = useStore((s) => s.loadSavedRuns);

  // Keyboard shortcuts (Space / S / R)
  useKeyboardShortcuts();

  // Track whether this is first mount
  const mountedRef = useRef(false);

  // Load persisted state on mount
  useEffect(() => {
    loadSettings();
    loadSavedRuns();
  }, [loadSettings, loadSavedRuns]);

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
          <RunBar />
        </div>
      </div>

      <aside className={styles.rightRail}>
        <MonitorPanel />
      </aside>
    </div>
  );
}
