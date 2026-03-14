import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../components/layout';
import { cElegans302Atlas } from '../data/cElegans302Atlas';
import { LEGEND_ITEMS } from '../engine/constants';
import { buildConnectomeFrame, describeConnectomeNeuron } from '../engine/connectome';
import { deepClone } from '../engine/math';
import type { Snapshot } from '../engine/types';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { renderSimulation, type Camera, type RenderState } from '../renderer/CanvasRenderer';
import { useStore } from '../store';
import styles from './NexusView.module.css';

const VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 580;
const PADDING_X = 78;
const BODY_TOP = 90;
const BODY_BOTTOM = 88;
const BODY_WIDTH = VIEWBOX_WIDTH - PADDING_X * 2;
const BODY_HEIGHT = VIEWBOX_HEIGHT - BODY_TOP - BODY_BOTTOM;
const REGION_Y = 22;
const REGION_HEIGHT = VIEWBOX_HEIGHT - 46;
const AXIS_LABEL_Y = 16;
const FOOT_LABEL_Y = 572;

function stateLabelFor(isKorean: boolean, state: Snapshot['state'] | null) {
  if (state === 'cruise') return isKorean ? '전진' : 'Cruise';
  if (state === 'reverse') return isKorean ? '후진' : 'Reverse';
  if (state === 'turn') return isKorean ? '회전' : 'Turn';
  return isKorean ? '대기' : 'Idle';
}

function connectionColor(family: 'sensory' | 'integration' | 'motor') {
  if (family === 'sensory') return 'rgba(125, 226, 207, 0.82)';
  if (family === 'integration') return 'rgba(156, 184, 255, 0.82)';
  return 'rgba(245, 201, 123, 0.88)';
}

function neuronPoint(name: string) {
  const entry = cElegans302Atlas.find((item) => item.name === name);
  if (!entry) return null;

  return {
    x: PADDING_X + entry.projection.dorsal.x * BODY_WIDTH,
    y: BODY_TOP + entry.projection.dorsal.y * BODY_HEIGHT,
    entry,
  };
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

    renderSimulation(ctx, canvas, renderState);
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
      ambientBackdrop: true,
      wormStyleScale: 1 / camera.zoom,
      sceneStyleScale: 1 / camera.zoom,
    });
  }, [renderState]);

  return <canvas ref={canvasRef} className={styles.trackingCanvas} aria-label="Tracking view" />;
}

function NeuralAtlas({
  frame,
  selectedNeuron,
  setSelectedNeuron,
}: {
  frame: ReturnType<typeof buildConnectomeFrame>;
  selectedNeuron: string;
  setSelectedNeuron: (name: string) => void;
}) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={styles.neuralSvg}
      role="img"
      aria-label="C. elegans neural atlas"
    >
      <rect
        x="54"
        y={REGION_Y}
        width="250"
        height={REGION_HEIGHT}
        rx="26"
        fill="rgba(125, 226, 207, 0.04)"
        stroke="rgba(125, 226, 207, 0.12)"
      />
      <rect
        x="304"
        y={REGION_Y}
        width="392"
        height={REGION_HEIGHT}
        rx="26"
        fill="rgba(156, 184, 255, 0.03)"
        stroke="rgba(156, 184, 255, 0.10)"
      />
      <rect
        x="696"
        y={REGION_Y}
        width="230"
        height={REGION_HEIGHT}
        rx="26"
        fill="rgba(245, 201, 123, 0.04)"
        stroke="rgba(245, 201, 123, 0.10)"
      />

      {frame.pathways.map((pathway) => {
        const from = neuronPoint(pathway.from);
        const to = neuronPoint(pathway.to);
        if (!from || !to) return null;

        return (
          <line
            key={pathway.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={connectionColor(pathway.family)}
            strokeWidth={1.8 + pathway.strength * 3.4}
            strokeLinecap="round"
            opacity={0.28 + pathway.strength * 0.66}
          />
        );
      })}

      {cElegans302Atlas.map((entry) => {
        const x = PADDING_X + entry.projection.dorsal.x * BODY_WIDTH;
        const y = BODY_TOP + entry.projection.dorsal.y * BODY_HEIGHT;
        const activation = frame.activities[entry.name] ?? 0;
        const isHighlighted =
          frame.highlightedNames.includes(entry.name) || entry.name === selectedNeuron;
        const radius = 2.4 + activation * 5.6 + (isHighlighted ? 1.2 : 0);
        const fill =
          activation > 0.72
            ? '#7DE2CF'
            : activation > 0.48
              ? '#9CB8FF'
              : activation > 0.28
                ? '#F5C97B'
                : 'rgba(195, 208, 240, 0.34)';

        return (
          <circle
            key={entry.name}
            cx={x}
            cy={y}
            r={radius}
            fill={fill}
            stroke={isHighlighted ? 'rgba(255,255,255,0.92)' : 'rgba(6,8,12,0.92)'}
            strokeWidth={isHighlighted ? 1.4 : 0.7}
            className={styles.neuralNode}
            onClick={() => setSelectedNeuron(entry.name)}
          />
        );
      })}

      {frame.highlightedNames.slice(0, 8).map((name) => {
        const point = neuronPoint(name);
        if (!point) return null;

        const anchor = point.x > VIEWBOX_WIDTH - 180 ? 'end' : 'start';
        const dx = anchor === 'end' ? -10 : 10;
        return (
          <text
            key={`label-${name}`}
            x={point.x + dx}
            y={point.y - 9}
            textAnchor={anchor}
            className={styles.neuralNodeLabel}
          >
            {name}
          </text>
        );
      })}

      <g>
        <text x="179" y={AXIS_LABEL_Y} textAnchor="middle" className={styles.neuralAxisLabel}>
          Head sensory ring
        </text>
        <text x="500" y={AXIS_LABEL_Y} textAnchor="middle" className={styles.neuralAxisLabel}>
          Integration + command
        </text>
        <text x="811" y={AXIS_LABEL_Y} textAnchor="middle" className={styles.neuralAxisLabel}>
          Motor output
        </text>
        <text x="80" y={FOOT_LABEL_Y} className={styles.neuralFootLabel}>
          Head
        </text>
        <text x="902" y={FOOT_LABEL_Y} textAnchor="end" className={styles.neuralFootLabel}>
          Tail
        </text>
      </g>
    </svg>
  );
}

export function NexusView() {
  const { i18n } = useTranslation();
  const simInstance = useStore((s) => s.simInstance);
  const snapshot = useStore((s) => s.snapshot);
  const simRunning = useStore((s) => s.simRunning);
  const appliedConfig = useStore((s) => s.appliedConfig);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const running = useStore((s) => s.running);
  const timeScale = useStore((s) => s.timeScale);
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
      frame: buildConnectomeFrame(simInstance, serialized.snapshot),
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
    const active = frame.topNeurons.find((item) => item.name === selectedNeuron);
    const detail = describeConnectomeNeuron(selectedNeuron);
    return {
      ...detail,
      activation: frame.activities[selectedNeuron] ?? active?.activation ?? 0,
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

  return (
    <PageLayout title="" hideHeader contentClassName={styles.pageContent}>
      <div className={styles.workspace}>
        <div className={styles.bottomGrid}>
          <section className={`${styles.panel} ${styles.neuralPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Live Neural Simulation</span>
                <h2 className={styles.panelTitle}>Neural Simulation</h2>
              </div>
              <span className={styles.panelMeta}>
                {selectedInfo
                  ? `${selectedInfo.name} · ${Math.round(selectedInfo.activation * 100)}%`
                  : '302 atlas'}
              </span>
            </div>

            <div className={styles.neuralFrame}>
              <NeuralAtlas
                frame={frame}
                selectedNeuron={selectedNeuron}
                setSelectedNeuron={setSelectedNeuron}
              />
            </div>
          </section>

          <section className={`${styles.panel} ${styles.trackingPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Live Tracking Camera</span>
                <h2 className={styles.panelTitle}>Tracking View</h2>
              </div>
              <span className={styles.statePill}>{currentStateLabel}</span>
            </div>

            <div className={styles.trackingFrame}>
              <TrackingCanvas renderState={linkedRenderState} />
            </div>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.environmentPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>Live Environment</span>
              <h2 className={styles.panelTitle}>Environment Simulation</h2>
            </div>
            <span className={styles.statePill}>{currentStateLabel}</span>
          </div>

          <div className={styles.environmentFrame}>
            <EnvironmentCanvas renderState={linkedRenderState} />
            <div className={styles.legendOverlay}>
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
