import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Connectome2Atlas } from '../components/common/Connectome2Atlas';
import { WormTracking3D } from '../components/common/WormTracking3D';
import { PageLayout } from '../components/layout';
import { LEGEND_ITEMS } from '../engine/constants';
import {
  buildConnectome2Frame,
  describeConnectome2Neuron,
} from '../engine/connectome2';
import { deepClone } from '../engine/math';
import type { Snapshot } from '../engine/types';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { renderSimulation, type Camera, type RenderState } from '../renderer/CanvasRenderer';
import { useStore } from '../store';
import styles from './NexusView.module.css';

function stateLabelFor(isKorean: boolean, state: Snapshot['state'] | null) {
  if (state === 'cruise') return isKorean ? '전진' : 'Cruise';
  if (state === 'reverse') return isKorean ? '후진' : 'Reverse';
  if (state === 'turn') return isKorean ? '회전' : 'Turn';
  return isKorean ? '대기' : 'Idle';
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function EnvironmentCanvas({
  renderState,
}: {
  renderState: RenderState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderSimulation(ctx, canvas, renderState, {
      suppressWorldBorder: true,
      suppressWorldCueBorder: true,
      ambientBackdrop: true,
    });
  }, [renderState]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.environmentCanvas}
      aria-label="Environment simulation"
    />
  );
}

function TrackingCanvas({
  renderState,
}: {
  renderState: RenderState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const worm = renderState.worm;
    let rotation = 0;

    if (worm.segments.length >= 2) {
      const head = worm.segments[0];
      const neck = worm.segments[1];
      rotation = Math.atan2(head.y - neck.y, head.x - neck.x) - Math.PI / 2;
    }

    const camera: Camera = {
      x: worm.x,
      y: worm.y,
      zoom: 2.45,
      rotation,
    };

    const trackedRenderState: RenderState = {
      ...renderState,
      camera,
    };

    renderSimulation(ctx, canvas, trackedRenderState, {
      suppressWorldBorder: true,
      suppressWorldCueBorder: true,
      ambientBackdrop: true,
      wormStyleScale: 1 / camera.zoom,
      sceneStyleScale: 1 / camera.zoom,
    });
  }, [renderState]);

  return <canvas ref={canvasRef} className={styles.trackingCanvas} aria-label="Tracking view" />;
}

export function NexusView() {
  const { i18n } = useTranslation();
  const simInstance = useStore((s) => s.simInstance);
  const snapshot = useStore((s) => s.snapshot);
  const simRunning = useStore((s) => s.simRunning);
  const appliedConfig = useStore((s) => s.appliedConfig);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const createSimulation = useStore((s) => s.createSimulation);
  const stepSimulation = useStore((s) => s.stepSimulation);
  const updateSnapshot = useStore((s) => s.updateSnapshot);
  const isKorean = i18n.language.startsWith('ko');
  const mountedRef = useRef(false);
  const [selectedNeuron, setSelectedNeuron] = useState('AVBL');

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (!simInstance) {
        createSimulation(appliedConfig, appliedSeed);
      }
    }
  }, [simInstance, createSimulation, appliedConfig, appliedSeed]);

  useEffect(() => {
    if (!mountedRef.current || !simInstance) return;
    simInstance.setConfig(appliedConfig, true);
    if (simInstance.getSeed() !== appliedSeed) {
      simInstance.setSeed(appliedSeed);
    }
    updateSnapshot();
  }, [appliedConfig, appliedSeed, simInstance, updateSnapshot]);

  const onFrame = useCallback(
    (dt: number) => {
      const scaledDt = dt;
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
    [stepSimulation],
  );

  useAnimationFrame(onFrame, simRunning && simInstance !== null);

  const nexusViewState = useMemo(() => {
    if (!simInstance || !snapshot) return null;

    const serialized = simInstance.serialize();
    const liveState = simInstance.getState();
    const renderState: RenderState = {
      worm: serialized.worm,
      world: serialized.world,
      config: serialized.config,
      samplePoints: deepClone(simInstance.getSamplePoints()),
      eventMarkers: deepClone(liveState.eventMarkers),
      metrics: serialized.metrics,
      highlightCues: {},
      previewCue: null,
    };

    return {
      snapshot: serialized.snapshot,
      renderState,
      frame: buildConnectome2Frame(simInstance, serialized.snapshot),
    };
  }, [simInstance, snapshot]);

  const frame = nexusViewState?.frame ?? null;
  const linkedSnapshot = nexusViewState?.snapshot ?? null;
  const linkedRenderState = nexusViewState?.renderState ?? null;

  useEffect(() => {
    if (!frame) return;
    if (!(selectedNeuron in frame.activities)) {
      setSelectedNeuron(frame.topNeurons[0]?.name ?? 'AVBL');
    }
  }, [frame, selectedNeuron]);

  const selectedInfo = useMemo(() => {
    if (!frame) return null;
    const detail = describeConnectome2Neuron(selectedNeuron);
    return {
      ...detail,
      activation: Math.abs(frame.activities[selectedNeuron] ?? 0),
      signedActivity: frame.activities[selectedNeuron] ?? 0,
    };
  }, [frame, selectedNeuron]);

  const currentStateLabel = stateLabelFor(isKorean, linkedSnapshot?.state ?? null);

  if (!frame || !simInstance || !linkedSnapshot || !linkedRenderState) {
    return (
      <PageLayout title="" hideHeader contentClassName={styles.pageContent}>
        <div className={styles.emptyState}>
          <h2>{isKorean ? 'Synchrony 준비 중' : 'Preparing Synchrony'}</h2>
          <p>
            {isKorean
              ? '환경, 뉴런, 트래킹 화면을 연결한 라이브 뷰를 초기화하고 있습니다.'
              : 'Initializing the linked environment, neural, and tracking views.'}
          </p>
        </div>
      </PageLayout>
    );
  }

  const liveState = simInstance.getState();

  return (
    <PageLayout title="" hideHeader contentClassName={styles.pageContent}>
      <div className={styles.workspace}>
        <div className={styles.bottomGrid}>
          <section className={`${styles.panel} ${styles.neuralPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>
                  {isKorean ? '302개 뉴런 지도' : '302-Neuron Atlas'}
                </span>
                <h2 className={styles.panelTitle}>{isKorean ? '뉴런 지도' : 'Neural Atlas'}</h2>
              </div>
              <span className={styles.panelMeta}>
                {selectedInfo
                  ? `${selectedInfo.name} · ${formatSignedPercent(selectedInfo.signedActivity)}`
                  : '302 atlas'}
              </span>
            </div>

            <div className={styles.neuralFrame}>
              <Connectome2Atlas
                frame={frame}
                selectedNeuron={selectedNeuron}
                setSelectedNeuron={setSelectedNeuron}
                wrapperClassName={styles.neuralViewport}
                enablePan
                classNames={{
                  svg: styles.neuralSvg,
                  node: styles.neuralNode,
                  nodeLabel: styles.neuralNodeLabel,
                  axisLabel: styles.neuralAxisLabel,
                  footLabel: styles.neuralFootLabel,
                }}
                highlightedLabelLimit={10}
              />
            </div>
          </section>

          <section className={`${styles.panel} ${styles.trackingPanel} ${styles.bleedPanel}`}>
            <div className={styles.trackingFrame}>
              <WormTracking3D
                className={styles.trackingCanvas}
                worm={liveState.worm}
                world={liveState.world}
                snapshot={linkedSnapshot}
                config={linkedRenderState.config}
                eventMarkers={linkedRenderState.eventMarkers}
                defaultPreset="follow"
                overlayTop="84px"
                showTemperatureField={
                  linkedRenderState.config.world.temperatureMode !== 'none' &&
                  linkedRenderState.config.visuals.showTemperatureOverlay
                }
                fallback={<TrackingCanvas renderState={linkedRenderState} />}
              />
            </div>

            <div className={`${styles.panelHeader} ${styles.bleedHeader}`}>
              <div className={styles.panelHeaderCopy}>
                <span className={styles.panelEyebrow}>
                  {isKorean ? '머리 중심 추적 시점' : 'Head-Centered Camera'}
                </span>
                <h2 className={styles.panelTitle}>
                  {isKorean ? '트래킹 카메라' : 'Tracking Camera'}
                </h2>
              </div>
              <span className={styles.statePill}>{currentStateLabel}</span>
            </div>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.environmentPanel} ${styles.bleedPanel}`}>
          <div className={styles.environmentFrame}>
            <EnvironmentCanvas renderState={linkedRenderState} />
          </div>

          <div className={`${styles.panelHeader} ${styles.bleedHeader} ${styles.environmentHeader}`}>
            <div className={styles.panelHeaderCopy}>
              <span className={styles.panelEyebrow}>
                {isKorean ? '공유 환경 상태' : 'Shared World State'}
              </span>
              <h2 className={styles.panelTitle}>
                {isKorean ? '환경 시뮬레이션' : 'Environment Arena'}
              </h2>
            </div>
            <div className={styles.headerLegend}>
              {LEGEND_ITEMS.map((item) => (
                <span key={item.label} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
