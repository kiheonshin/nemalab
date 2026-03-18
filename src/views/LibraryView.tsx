// ============================================================================
// LibraryView — Preset library with live preview cards
// ============================================================================

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/common';
import { PageLayout } from '../components/layout';
import { useStore } from '../store';
import { PRESETS, DEFAULT_CONFIG } from '../engine/constants';
import { mergeDeep, deepClone, getByPath } from '../engine/math';
import { trackEvent, EVENTS } from '../analytics';
import { WormSimulation } from '../engine/WormSimulation';
import { randomSeed } from '../engine/rng';
import { renderSimulation, type RenderState } from '../renderer/CanvasRenderer';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import type { SimConfig } from '../engine/types';
import styles from './LibraryView.module.css';

// ---- Sensor indicator pill ----
function SensorPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`${styles.sensorPill} ${active ? styles.sensorPillActive : ''}`}>
      {label}
    </span>
  );
}

// ---- Resolve merged config for a preset ----
function resolvedConfig(overrides: Record<string, unknown>): SimConfig {
  return mergeDeep(
    deepClone(DEFAULT_CONFIG) as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as unknown as SimConfig;
}

// ---- Extract key parameter diffs from default ----
const PARAM_PATHS: Array<{ path: string; label: string; fmt?: (v: unknown) => string }> = [
  { path: 'worm.baseSpeed', label: 'Speed' },
  { path: 'worm.turnSharpness', label: 'Turn' },
  { path: 'behavior.gradientGain', label: 'Gradient' },
  { path: 'behavior.exploration', label: 'Explore' },
  { path: 'behavior.turnProbability', label: 'Turn P' },
  { path: 'world.obstacleDensity', label: 'Obstacle', fmt: (v) => `${((v as number) * 100).toFixed(0)}%` },
  { path: 'world.temperatureMode', label: 'Temp', fmt: (v) => String(v) },
  { path: 'sensors.noise', label: 'Noise' },
];

function getKeyDiffs(config: SimConfig): Array<{ label: string; value: string }> {
  const diffs: Array<{ label: string; value: string }> = [];
  for (const p of PARAM_PATHS) {
    const cur = getByPath(config as unknown as Record<string, unknown>, p.path);
    const def = getByPath(DEFAULT_CONFIG as unknown as Record<string, unknown>, p.path);
    if (p.path === 'world.obstacleDensity' || cur !== def) {
      const formatted = p.fmt ? p.fmt(cur) : String(cur);
      diffs.push({ label: p.label, value: formatted });
    }
  }
  return diffs;
}

// ---- Live preview canvas with camera following the worm ----
function PresetPreview({ config }: { config: SimConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<WormSimulation | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    simRef.current = new WormSimulation(config, randomSeed());
    setReady(true);
    return () => {
      simRef.current = null;
      setReady(false);
    };
  }, [config]);

  const onFrame = useCallback((dt: number) => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;

    sim.step(Math.min(dt, 1 / 30));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = sim.getState();
    const renderState: RenderState = {
      worm: state.worm,
      world: state.world,
      config: sim.getConfig(),
      samplePoints: sim.getSamplePoints(),
      eventMarkers: state.eventMarkers,
      metrics: state.metrics,
      highlightCues: {},
      previewCue: null,
    };
    renderSimulation(ctx, canvas, renderState);

    // Apply CSS zoom centered on worm
    const wx = (state.worm.x / 100) * 100;
    const wy = (state.worm.y / 100) * 100;
    canvas.style.transformOrigin = `${wx}% ${wy}%`;
  }, []);

  useAnimationFrame(onFrame, ready);

  return (
    <div className={styles.previewFrame}>
      <canvas
        ref={canvasRef}
        className={styles.previewCanvas}
      />
    </div>
  );
}

export function LibraryView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const createSimulation = useStore((s) => s.createSimulation);
  const showToast = useStore((s) => s.showToast);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const libraryTitle = i18n.language.startsWith('ko') ? '라이브러리' : 'Library';

  const handleStartPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    trackEvent(EVENTS.PRESET_LOAD, { preset_id: presetId });
    const config = resolvedConfig(preset.overrides as Record<string, unknown>);
    useStore.setState({
      appliedConfig: deepClone(config),
      draftConfig: deepClone(config),
      appliedSeed,
      draftSeed: appliedSeed,
      dirtyPaths: new Set<string>(),
      visualDirtyPaths: new Set<string>(),
      running: true,
    });
    createSimulation(config, appliedSeed);
    showToast(t('library.startPresetToast', { preset: preset.name }));
    navigate('/simulator');
  };

  return (
    <PageLayout
      eyebrow={t('nav.library')}
      title={libraryTitle}
      contentClassName={styles.pageContent}
    >
      <div className={styles.grid}>
        {PRESETS.map((preset) => {
          const config = resolvedConfig(preset.overrides as Record<string, unknown>);
          const diffs = getKeyDiffs(config);

          return (
            <Card key={preset.id} padding="default" className={styles.card}>
              <div className={styles.cardBody}>
                {/* Live preview */}
                <PresetPreview config={config} />

                <h3 className={styles.cardTitle}>
                  {preset.name}
                </h3>
                <p className={styles.cardDescription}>
                  {t(`library.presets.${preset.id}.description`, { defaultValue: preset.description })}
                </p>

                {/* Sensor indicators */}
                <div className={styles.sensorRow}>
                  <span className={styles.sensorLabel}>
                    {t('sensors.title')}:
                  </span>
                  <SensorPill label={t('sensors.touch')} active={config.sensors.touch} />
                  <SensorPill label={t('sensors.chemo')} active={config.sensors.chemo} />
                  <SensorPill label={t('sensors.thermo')} active={config.sensors.thermo} />
                </div>

                {/* Key parameter diffs from default */}
                {diffs.length > 0 && (
                  <div className={styles.diffList}>
                    {diffs.map((d) => (
                      <span key={d.label} className={styles.diffChip}>
                        <span className={styles.diffKey}>{d.label}:</span>
                        <span className={styles.diffValue}>{d.value}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <Button variant="primary" onClick={() => handleStartPreset(preset.id)}>
                    {t('library.start')}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageLayout>
  );
}
