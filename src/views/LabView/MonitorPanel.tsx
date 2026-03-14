// ============================================================================
// MonitorPanel — Right rail showing explanation, sensor summary, worm state,
// and recent events.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store';
import { generateExplanations, type ExplanationContext } from '../../engine/ExplanationEngine';
import { formatNumber, timeLabel } from '../../engine/math';
import type { Explanation } from '../../engine/types';
import { renderSimulation, type Camera, type RenderState } from '../../renderer/CanvasRenderer';
import styles from '../LabView.module.css';

const IDLE_EXPLANATIONS: Explanation[] = [{ key: 'explanation.idle', params: {} }];

function TrackingPreview({
  simInstance,
  snapshot,
}: {
  simInstance: NonNullable<ReturnType<typeof useStore.getState>['simInstance']>;
  snapshot: NonNullable<ReturnType<typeof useStore.getState>['snapshot']>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const internalState = simInstance.getState();
    const worm = internalState.worm;
    let rotation = 0;

    if (worm.segments.length >= 2) {
      const head = worm.segments[0];
      const neck = worm.segments[1];
      rotation = Math.atan2(head.y - neck.y, head.x - neck.x) - Math.PI / 2;
    }

    const camera: Camera = {
      x: worm.x,
      y: worm.y,
      zoom: 2.5,
      rotation,
    };

    const renderState: RenderState = {
      worm,
      world: internalState.world,
      config: simInstance.getConfig(),
      samplePoints: simInstance.getSamplePoints(),
      eventMarkers: internalState.eventMarkers,
      metrics: internalState.metrics,
      highlightCues: {},
      previewCue: null,
      camera,
    };

    renderSimulation(ctx, canvas, renderState, {
      suppressWorldBorder: true,
      ambientBackdrop: true,
      wormStyleScale: 1 / camera.zoom,
      sceneStyleScale: 1 / camera.zoom,
    });
  }, [simInstance, snapshot]);

  return (
    <div className={styles.trackingCanvasFrame}>
      <canvas ref={canvasRef} className={styles.trackingCanvas} />
    </div>
  );
}

export function MonitorPanel() {
  const { t } = useTranslation();
  const simInstance = useStore((s) => s.simInstance);
  const snapshot = useStore((s) => s.snapshot);
  const [displayExplanations, setDisplayExplanations] = useState<Explanation[]>(IDLE_EXPLANATIONS);
  const latestExplanationsRef = useRef<Explanation[]>(IDLE_EXPLANATIONS);
  const [showTracking, setShowTracking] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 768px)').matches;
  });
  const hasData = simInstance !== null && snapshot !== null;

  // Generate explanations
  const explanations = useMemo(
    () => {
      if (!simInstance || !snapshot) {
        return IDLE_EXPLANATIONS;
      }

      const internalState = simInstance.getState();
      const explanationCtx: ExplanationContext = {
        config: simInstance.getConfig(),
        worm: internalState.worm,
        sensor: internalState.sensor,
        world: internalState.world,
        metrics: internalState.metrics,
        recentEvents: internalState.recentEvents,
        wasInsideFood:
          Math.hypot(
            internalState.worm.x - internalState.world.food.x,
            internalState.worm.y - internalState.world.food.y,
          ) <= internalState.world.food.radius * 0.95,
      };

      return generateExplanations(explanationCtx);
    },
    [simInstance, snapshot],
  );

  latestExplanationsRef.current = explanations;

  useEffect(() => {
    setDisplayExplanations(hasData ? latestExplanationsRef.current : IDLE_EXPLANATIONS);
  }, [hasData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDisplayExplanations(latestExplanationsRef.current);
    }, 720);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateTrackingVisibility = () => setShowTracking(!mediaQuery.matches);

    updateTrackingVisibility();
    mediaQuery.addEventListener('change', updateTrackingVisibility);

    return () => mediaQuery.removeEventListener('change', updateTrackingVisibility);
  }, []);

  if (!simInstance || !snapshot) {
    return (
      <>
        {showTracking ? (
          <div className={`${styles.monitorSection} ${styles.trackingSection}`}>
            <span className={styles.monitorTitle}>{t('lab.tracking')}</span>
            <div className={styles.trackingCanvasFrame} />
          </div>
        ) : null}
        <div className={styles.monitorSection}>
          <span className={styles.monitorTitle}>{t('monitor.state')}</span>
          <p className={styles.explanationText}>{t('explanation.idle')}</p>
        </div>
      </>
    );
  }

  const metrics = snapshot.metrics;

  return (
    <>
      {showTracking ? (
        <div className={`${styles.monitorSection} ${styles.trackingSection}`}>
          <span className={styles.monitorTitle}>{t('lab.tracking')}</span>
          <TrackingPreview simInstance={simInstance} snapshot={snapshot} />
        </div>
      ) : null}

      {/* --- State + Explanation --- */}
      <div className={styles.monitorSection}>
        <span className={styles.monitorTitle}>{t('monitor.state')}</span>
        <div className={styles.explanationText}>
          {displayExplanations.map((exp, i) => (
            <div key={i}>{t(exp.key, exp.params)}</div>
          ))}
        </div>
      </div>

      {/* --- Sensor Summary --- */}
      <div className={styles.monitorSection}>
        <span className={styles.monitorTitle}>{t('monitor.sensorSummary')}</span>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('sensors.chemo')}</span>
          <span className={styles.metricValue}>
            L:{formatNumber(snapshot.sensor.chemoLeft, 4)} R:
            {formatNumber(snapshot.sensor.chemoRight, 4)}
          </span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('sensors.thermo')}</span>
          <span className={styles.metricValue}>
            {formatNumber(snapshot.sensor.tempCurrent, 2)} (err:{' '}
            {formatNumber(snapshot.sensor.tempError, 3)})
          </span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('sensors.touch')}</span>
          <span className={styles.metricValue}>
            F:{snapshot.sensor.touchFront ? 'Y' : 'N'} L:
            {snapshot.sensor.touchLeft ? 'Y' : 'N'} R:
            {snapshot.sensor.touchRight ? 'Y' : 'N'}
          </span>
        </div>
      </div>

      {/* --- Metrics --- */}
      <div className={styles.monitorSection}>
        <span className={styles.monitorTitle}>{t('monitor.wormState')}</span>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.elapsed')}</span>
          <span className={styles.metricValue}>{timeLabel(metrics.elapsed)}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.distance')}</span>
          <span className={styles.metricValue}>{formatNumber(metrics.distance, 1)}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.collisions')}</span>
          <span className={styles.metricValue}>{metrics.collisions}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.turns')}</span>
          <span className={styles.metricValue}>{metrics.turns}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.reversals')}</span>
          <span className={styles.metricValue}>{metrics.reversals}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.foodTime')}</span>
          <span className={styles.metricValue}>{timeLabel(metrics.foodTime)}</span>
        </div>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>{t('monitor.firstFood')}</span>
          <span className={styles.metricValue}>{timeLabel(metrics.firstFoodTime)}</span>
        </div>
      </div>

      {/* --- Recent Events --- */}
      <div className={`${styles.monitorSection} ${styles.eventSection}`}>
        <span className={styles.monitorTitle}>{t('monitor.recentEvents')}</span>
        <ul className={styles.eventList}>
          {snapshot.events.map((event, i) => {
            const dotColor =
              event.type === 'collision'
                ? 'var(--color-danger)'
                : event.type === 'turn'
                  ? 'var(--color-warning)'
                  : 'var(--color-accent)';
            return (
              <li key={`${event.type}-${event.time}-${i}`} className={styles.eventItem}>
                <span
                  className={styles.eventDot}
                  style={{ background: dotColor }}
                />
                <span>
                  [{formatNumber(event.time, 1)}s] {event.title}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

    </>
  );
}
