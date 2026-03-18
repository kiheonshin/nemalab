// ============================================================================
// CompareView - A/B side-by-side simulation comparison
// ============================================================================

import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Slider } from '../components/common';
import { PageLayout } from '../components/layout';
import { useStore } from '../store';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { trackEvent, EVENTS } from '../analytics';
import { renderSimulation, type RenderState } from '../renderer/CanvasRenderer';
import { formatNumber, timeLabel } from '../engine/math';
import type { Metrics, Snapshot } from '../engine/types';
import styles from './CompareView.module.css';

function StageCanvas({
  sim,
  snapshot,
}: {
  sim: import('../engine/WormSimulation').WormSimulation | null;
  snapshot: Snapshot | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sim) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const internalState = sim.getState();

    const renderState: RenderState = {
      worm: internalState.worm,
      world: internalState.world,
      config: sim.getConfig(),
      samplePoints: sim.getSamplePoints(),
      eventMarkers: internalState.eventMarkers,
      metrics: internalState.metrics,
      highlightCues: {},
      previewCue: null,
    };

    renderSimulation(ctx, canvas, renderState);
  }, [sim, snapshot]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.stageCanvas}
    />
  );
}

function MetricsDisplay({
  label,
  metrics,
  t,
  className,
  showLabel = true,
}: {
  label?: string;
  metrics: Metrics | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  className?: string;
  showLabel?: boolean;
}) {
  const classes = [styles.metricsPanel, className].filter(Boolean).join(' ');
  const hasLabel = showLabel && Boolean(label?.trim());

  if (!metrics) {
    return (
      <div className={classes}>
        {hasLabel ? <div className={styles.metricsPanelTitle}>{label}</div> : null}
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>--</span>
        </div>
      </div>
    );
  }

  return (
    <div className={classes}>
      {hasLabel ? (
        <div className={styles.metricsHeader}>
          <div className={styles.metricsPanelTitle}>{label}</div>
        </div>
      ) : null}
      <div className={styles.metricsGrid}>
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
      </div>
    </div>
  );
}

function VariantControlPanel({
  title,
  t,
  className,
}: {
  title: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  className?: string;
}) {
  const variantDraft = useStore((s) => s.variantDraft);
  const compareDirtyPaths = useStore((s) => s.compareDirtyPaths);
  const setVariantDraftValue = useStore((s) => s.setVariantDraftValue);
  const applyVariant = useStore((s) => s.applyVariant);

  const dirty = compareDirtyPaths.size > 0;
  const classes = [styles.variantControls, className].filter(Boolean).join(' ');
  const dirtyFields = Array.from(compareDirtyPaths);

  const handleApply = () => {
    if (!dirty) return;

    trackEvent(EVENTS.COMPARE_VARIANT_CHANGE, {
      field_count: dirtyFields.length,
      fields: dirtyFields.join(','),
    });
    applyVariant();
  };

  return (
    <div className={classes}>
      <div className={styles.variantHeader}>
        <div className={styles.variantTitle}>{title}</div>
        <Button
          variant="primary"
          size="small"
          onClick={handleApply}
          disabled={!dirty}
        >
          {t('lab.apply')}
        </Button>
      </div>

      <Slider
        label={t('params.baseSpeed')}
        value={variantDraft.worm.baseSpeed}
        min={5}
        max={30}
        step={0.5}
        onChange={(v) => setVariantDraftValue('worm.baseSpeed', v)}
        dirty={compareDirtyPaths.has('worm.baseSpeed')}
      />
      <Slider
        label={t('params.turnSharpness')}
        value={variantDraft.worm.turnSharpness}
        min={0.4}
        max={3}
        step={0.1}
        onChange={(v) => setVariantDraftValue('worm.turnSharpness', v)}
        dirty={compareDirtyPaths.has('worm.turnSharpness')}
      />
      <Slider
        label={t('params.gradientGain')}
        value={variantDraft.behavior.gradientGain}
        min={0}
        max={4}
        step={0.1}
        onChange={(v) => setVariantDraftValue('behavior.gradientGain', v)}
        dirty={compareDirtyPaths.has('behavior.gradientGain')}
      />
      <Slider
        label={t('params.exploration')}
        value={variantDraft.behavior.exploration}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setVariantDraftValue('behavior.exploration', v)}
        dirty={compareDirtyPaths.has('behavior.exploration')}
      />
      <Slider
        label={t('params.turnProbability')}
        value={variantDraft.behavior.turnProbability}
        min={0}
        max={0.2}
        step={0.005}
        onChange={(v) => setVariantDraftValue('behavior.turnProbability', v)}
        dirty={compareDirtyPaths.has('behavior.turnProbability')}
      />
      <Slider
        label={t('params.noise')}
        value={variantDraft.sensors.noise}
        min={0}
        max={0.5}
        step={0.01}
        onChange={(v) => setVariantDraftValue('sensors.noise', v)}
        dirty={compareDirtyPaths.has('sensors.noise')}
      />
    </div>
  );
}

export function CompareView() {
  const { t, i18n } = useTranslation();
  const compareRunning = useStore((s) => s.compareRunning);
  const compareTimeScale = useStore((s) => s.compareTimeScale);
  const simA = useStore((s) => s.simA);
  const simB = useStore((s) => s.simB);
  const snapshotA = useStore((s) => s.snapshotA);
  const snapshotB = useStore((s) => s.snapshotB);
  const initCompareSimulations = useStore((s) => s.initCompareSimulations);
  const stepCompare = useStore((s) => s.stepCompare);
  const isKorean = i18n.language.startsWith('ko');
  const baselineLabel = isKorean ? '기준 (A)' : 'Baseline (A)';
  const settingsLabel = isKorean ? '실험 설정' : 'Experiment Settings';

  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      initCompareSimulations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFrame = useCallback(
    (dt: number) => {
      const scaledDt = dt * compareTimeScale;
      const fixedStep = 1 / 60;
      let remaining = scaledDt;

      while (remaining > fixedStep) {
        stepCompare(fixedStep);
        remaining -= fixedStep;
      }

      if (remaining > 0) {
        stepCompare(remaining);
      }
    },
    [stepCompare, compareTimeScale],
  );

  useAnimationFrame(onFrame, compareRunning && simA !== null && simB !== null);

  return (
    <PageLayout
      eyebrow={t('nav.compare')}
      title={t('compare.title')}
      contentClassName={styles.pageContent}
    >
      <div className={styles.stageGrid}>
        <VariantControlPanel
          title={settingsLabel}
          t={t}
          className={styles.mobileSettingsPanel}
        />

        <div className={styles.stagePanel}>
          <div className={styles.stageHeader}>
            <span className={styles.stageTitle}>{t('compare.baseline')}</span>
          </div>
          <div className={styles.canvasWrapper}>
            <StageCanvas sim={simA} snapshot={snapshotA} />
          </div>
          <MetricsDisplay
            label={baselineLabel}
            showLabel={false}
            metrics={snapshotA?.metrics ?? null}
            t={t}
            className={styles.leftOverlay}
          />
        </div>

        <div className={styles.stagePanel}>
          <div className={styles.stageHeader}>
            <span className={styles.stageTitle}>{t('compare.variant')}</span>
          </div>
          <div className={styles.canvasWrapper}>
            <StageCanvas sim={simB} snapshot={snapshotB} />
          </div>
          <VariantControlPanel
            title={settingsLabel}
            t={t}
            className={`${styles.rightOverlay} ${styles.desktopVariantControls}`}
          />
        </div>
      </div>
    </PageLayout>
  );
}
