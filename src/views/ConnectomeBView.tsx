import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout } from '../components/layout';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { trackEvent, EVENTS } from '../analytics';
import connectomeBDataRaw from '../data/connectomeBData.json';
import {
  buildConnectomeBFrame,
  connectomeBActivityColor,
  connectomeBRoleColor,
  describeConnectomeBNeuron,
  type ConnectomeBNeuronActivity,
  type ConnectomeBPathway,
  type ConnectomeBSignal,
} from '../engine/connectomeB';
import type { Snapshot } from '../engine/types';
import { renderSimulation, type RenderState } from '../renderer/CanvasRenderer';
import { useStore } from '../store';
import styles from './ConnectomeView.module.css';

const VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 580;
const PADDING_X = 72;
const PADDING_Y = 78;
const BODY_WIDTH = VIEWBOX_WIDTH - PADDING_X * 2;
const BODY_HEIGHT = VIEWBOX_HEIGHT - PADDING_Y * 2;
const DISPLAY_REFRESH_MS = 60;

interface ConnectomeBNode {
  name: string;
  xNorm: number;
  zNorm: number;
  role: string;
  bodyZone: string;
  side: string;
}

const connectomeBNodes = (connectomeBDataRaw as { nodes: ConnectomeBNode[] }).nodes;
const CONNECTOME_B_BY_NAME = new Map(connectomeBNodes.map((node) => [node.name, node]));

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

function ToolbarButton({
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
      className={`${styles.toolbarButton} ${active ? styles.toolbarButtonActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.toolbarButtonIcon}>{icon}</span>
      <span className={styles.toolbarButtonLabel}>{label}</span>
    </button>
  );
}

function LabPreview({
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
    const renderState: RenderState = {
      worm: internalState.worm,
      world: internalState.world,
      config: simInstance.getConfig(),
      samplePoints: simInstance.getSamplePoints(),
      eventMarkers: internalState.eventMarkers,
      metrics: internalState.metrics,
      highlightCues: {},
      previewCue: null,
    };

    renderSimulation(ctx, canvas, renderState);
  }, [simInstance, snapshot]);

  return <canvas ref={canvasRef} className={styles.previewCanvas} aria-label="Connectome preview canvas" />;
}

function translateSignalLabel(label: string, isKorean: boolean) {
  if (!isKorean) return label;

  const labels: Record<string, string> = {
    'Chemical gradient': '화학 기울기',
    'Thermal error': '온도 오차',
    'Mechanosensory alert': '촉각 경보',
    'Food proximity': '먹이 근접도',
    'Forward drive': '직진 구동',
    'Turn drive': '회전 구동',
    'Reverse drive': '후진 구동',
  };

  return labels[label] ?? label;
}

function translateRoleLabel(label: string, isKorean: boolean) {
  if (!isKorean) return label;

  const labels: Record<string, string> = {
    'Sensory neuron': '감각 뉴런',
    'Sensory-motor neuron': '감각-운동 뉴런',
    Interneuron: '개재 뉴런',
    'Motor neuron': '운동 뉴런',
    'Pharyngeal neuron': '인두 뉴런',
    'CAN support neuron': 'CAN 보조 뉴런',
    'Other neuron': '기타 뉴런',
  };

  return labels[label] ?? label;
}

function translateBodyZone(value: string, isKorean: boolean) {
  if (!isKorean) return value;

  const zones: Record<string, string> = {
    head: '머리',
    midbody: '몸통',
    tail: '꼬리',
    whole: '전신',
    unknown: '미상',
  };

  return zones[value] ?? value;
}

function translateSide(value: string, isKorean: boolean) {
  if (!isKorean) return value;

  const sides: Record<string, string> = {
    left: '좌측',
    right: '우측',
    midline: '중앙',
    paired: '쌍측',
    unknown: '미상',
  };

  return sides[value] ?? value;
}

function connectomeSummaryForRole(role: string, isKorean: boolean) {
  if (!isKorean) return null;

  const summaries: Record<string, string> = {
    sensory: '외부 자극을 감지해 연결망 안으로 전달하는 감각 계열 뉴런입니다.',
    'sensory-motor': '감각 입력과 운동 출력을 가깝게 잇는 역할의 뉴런입니다.',
    interneuron: '감각 신호와 운동 명령 사이에서 신호를 중계하고 통합하는 개재 뉴런입니다.',
    motor: '자세 변화나 이동 실행으로 이어지는 하위 운동 출력을 담당하는 뉴런입니다.',
    pharyngeal: '체벽 운동계보다 인두 신경망과 더 가까운 역할을 가집니다.',
    can: '302개 atlas에 포함된 보조성 뉴런으로, 표준 기능 분류와는 다르게 표시됩니다.',
    other: 'atlas 안에 포함되지만 아직 더 구체적인 기능 설명이 연결되지 않은 뉴런입니다.',
  };

  return summaries[role] ?? summaries.other;
}

function narrativeCopy(
  presetKey: ReturnType<typeof buildConnectomeBFrame>['narrative']['presetKey'],
  isKorean: boolean,
) {
  if (!isKorean) return null;

  const copy: Record<typeof presetKey, { eyebrow: string; title: string; summary: string }> = {
    anterior_touch: {
      eyebrow: '번들 기반 뉴런 지도',
      title: '촉각 회피 오버레이',
      summary:
        '앞쪽 촉각 자극이 강해질 때 후진 명령 계열이 두드러지며, AVA·AVD·AVE 쪽 회피 흐름이 강조됩니다.',
    },
    posterior_touch: {
      eyebrow: '번들 기반 뉴런 지도',
      title: '전진 시작 오버레이',
      summary:
        '뒤쪽 촉각 입력이 전진 relay를 밀어올리며, PLM 계열 경로를 따라 AVB·PVC와 B형 운동 출력이 강조됩니다.',
    },
    warm_pulse_afd: {
      eyebrow: '번들 기반 뉴런 지도',
      title: '온도주성 오버레이',
      summary:
        '온도 변화의 중요도가 높아지면 AFD 중심 경로가 강화되고, AIY·AIZ 통합과 머리 조향 보정이 더 두드러집니다.',
    },
    odor_on_awc: {
      eyebrow: '번들 기반 뉴런 지도',
      title: '화학주성 오버레이',
      summary:
        '먹이와 냄새 단서가 AWC·AIY·AIB 계열 경로에 투영되며, 유인 반응과 직진 안정화 사이의 균형을 보여줍니다.',
    },
    noxious_ash: {
      eyebrow: '번들 기반 뉴런 지도',
      title: '회피 반응 오버레이',
      summary:
        '혐오성 자극이 ASH 중심 경로를 따라 퍼지며, 후진 명령과 재방향 전환에 연결된 개재 뉴런 흐름이 강조됩니다.',
    },
    oxygen_upshift: {
      eyebrow: '번들 기반 뉴런 지도',
      title: '탐색 상태 오버레이',
      summary:
        '외부 편향이 약할 때는 URX·RMG 계열의 탐색 모티프가 상대적으로 두드러지며, 각성된 전진 흐름이 유지됩니다.',
    },
  };

  return copy[presetKey];
}

function SignalBar({ signal, isKorean }: { signal: ConnectomeBSignal; isKorean: boolean }) {
  return (
    <div className={styles.signalRow}>
      <div className={styles.signalHeader}>
        <span className={styles.signalLabel}>{translateSignalLabel(signal.label, isKorean)}</span>
        <span className={styles.signalMeta}>
          {Math.round(signal.value * 100)}%
          {signal.polarity === 'left'
            ? ' / L'
            : signal.polarity === 'right'
              ? ' / R'
              : ''}
        </span>
      </div>
      <div className={styles.signalTrack}>
        <div className={styles.signalFill} style={{ width: `${Math.max(6, signal.value * 100)}%` }} />
      </div>
    </div>
  );
}

function nodePoint(name: string) {
  const entry = CONNECTOME_B_BY_NAME.get(name);
  if (!entry) return null;

  return {
    x: PADDING_X + entry.xNorm * BODY_WIDTH,
    y: PADDING_Y + (1 - entry.zNorm) * BODY_HEIGHT,
    entry,
  };
}

function formatState(state: Snapshot['state'], isKorean: boolean) {
  switch (state) {
    case 'cruise':
      return isKorean ? '직진' : 'Cruise';
    case 'reverse':
      return isKorean ? '후진' : 'Reverse';
    case 'turn':
      return isKorean ? '회전' : 'Turn';
    default:
      return isKorean ? '대기' : 'Idle';
  }
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function pathwayStroke(pathway: ConnectomeBPathway) {
  if (pathway.edgeType === 'electrical') {
    return pathway.flux >= 0 ? 'rgba(135, 167, 255, 0.44)' : 'rgba(111, 200, 255, 0.42)';
  }
  return pathway.flux >= 0 ? 'rgba(255, 138, 138, 0.58)' : 'rgba(111, 200, 255, 0.56)';
}

function pathwayWidth(pathway: ConnectomeBPathway) {
  return 1 + Math.min(4, Math.abs(pathway.flux) * (pathway.edgeType === 'effective' ? 6.4 : 4.4));
}

export function ConnectomeBView() {
  const simInstance = useStore((state) => state.simInstance);
  const snapshot = useStore((state) => state.snapshot);
  const simRunning = useStore((state) => state.simRunning);
  const appliedConfig = useStore((state) => state.appliedConfig);
  const appliedSeed = useStore((state) => state.appliedSeed);
  const running = useStore((state) => state.running);
  const timeScale = useStore((state) => state.timeScale);
  const createSimulation = useStore((state) => state.createSimulation);
  const stepSimulation = useStore((state) => state.stepSimulation);
  const setRunning = useStore((state) => state.setRunning);
  const setTimeScale = useStore((state) => state.setTimeScale);
  const resetRun = useStore((state) => state.resetRun);
  const resetSimulation = useStore((state) => state.resetSimulation);
  const updateSnapshot = useStore((state) => state.updateSnapshot);
  const showToast = useStore((state) => state.showToast);
  const mountedRef = useRef(false);
  const liveFrameRef = useRef<ReturnType<typeof buildConnectomeBFrame> | null>(null);
  const liveSnapshotRef = useRef<Snapshot | null>(null);
  const [selectedNeuron, setSelectedNeuron] = useState('AVBL');
  const [frame, setFrame] = useState<ReturnType<typeof buildConnectomeBFrame> | null>(null);
  const [displaySnapshot, setDisplaySnapshot] = useState<Snapshot | null>(null);
  const isKorean = false;

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

  const liveFrame = useMemo(() => {
    if (!simInstance || !snapshot) return null;
    return buildConnectomeBFrame(simInstance, snapshot);
  }, [simInstance, snapshot]);

  useEffect(() => {
    liveFrameRef.current = liveFrame;
    liveSnapshotRef.current = snapshot;

    if (!liveFrame || !snapshot) {
      setFrame(null);
      setDisplaySnapshot(null);
      return;
    }

    if (!frame || !displaySnapshot) {
      setFrame(liveFrame);
      setDisplaySnapshot(snapshot);
    }
  }, [liveFrame, snapshot, frame, displaySnapshot]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFrame(liveFrameRef.current);
      setDisplaySnapshot(liveSnapshotRef.current);
    }, DISPLAY_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!frame) return;
    if (!(selectedNeuron in frame.activities)) {
      setSelectedNeuron(frame.topNeurons[0]?.name ?? frame.narrative.route[0] ?? 'AVBL');
    }
  }, [frame, selectedNeuron]);

  const selectedInfo = useMemo(() => {
    if (!frame) return null;
    const detail = describeConnectomeBNeuron(selectedNeuron);
    const entry = CONNECTOME_B_BY_NAME.get(selectedNeuron);
    const signedActivity = frame.activities[selectedNeuron] ?? 0;
    const effectiveInput = frame.effectiveInputs[selectedNeuron] ?? 0;

    return {
      ...detail,
      entry,
      signedActivity,
      activation: Math.abs(signedActivity),
      effectiveInput,
    };
  }, [frame, selectedNeuron]);

  const handleReset = () => {
    resetRun();
    resetSimulation();
    showToast('Connectome experiment restarted.');
  };

  const summaryNeurons: ConnectomeBNeuronActivity[] = frame?.topNeurons.slice(0, 8) ?? [];
  const currentPreviewSnapshot = snapshot ?? displaySnapshot;
  const currentSceneState = currentPreviewSnapshot
    ? formatState(currentPreviewSnapshot.state, isKorean)
    : isKorean
      ? '대기'
      : 'Idle';
  const localizedNarrative = frame ? narrativeCopy(frame.narrative.presetKey, isKorean) : null;
  const narrativeEyebrow = localizedNarrative?.eyebrow ?? 'bundle-backed atlas';
  const narrativeTitle = localizedNarrative?.title ?? frame?.narrative.title ?? '';
  const narrativeSummary = localizedNarrative?.summary ?? frame?.narrative.summary ?? '';

  return (
    <PageLayout title="" hideHeader contentClassName={styles.pageContent}>
      {!frame || !simInstance || !displaySnapshot ? (
        <div className={styles.emptyState}>
          <h2>{isKorean ? 'Connectome 준비 중' : 'Preparing Connectome'}</h2>
          <p>
            {isKorean
              ? '번들 기반 뉴런 지도를 불러오고 현재 실험 상태와 동기화하고 있습니다.'
              : 'Loading the bundle-backed atlas overlay and syncing it to the current run.'}
          </p>
        </div>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.leftRail}>
            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{isKorean ? '??? ??' : 'Live Inputs'}</span>
                <span className={styles.sectionMeta}>{currentSceneState}</span>
              </div>
              <div className={styles.signalList}>
                {frame.signals.map((signal) => (
                  <SignalBar key={signal.key} signal={signal} isKorean={isKorean} />
                ))}
              </div>
            </section>

            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{isKorean ? '?? ???' : 'Behavior Snapshot'}</span>
              </div>
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricCardLabel}>{isKorean ? '?? ???' : 'Food proximity'}</span>
                  <span className={styles.metricCardValue}>{Math.round(frame.foodProximity * 100)}%</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricCardLabel}>{isKorean ? '??' : 'Speed'}</span>
                  <span className={styles.metricCardValue}>{displaySnapshot.speed.toFixed(1)} u/s</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricCardLabel}>{isKorean ? '?? ??' : 'Elapsed'}</span>
                  <span className={styles.metricCardValue}>{displaySnapshot.metrics.elapsed.toFixed(1)} s</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricCardLabel}>{isKorean ? '?? ????' : 'Sensor bias'}</span>
                  <span className={styles.metricCardValue}>{displaySnapshot.sensor.bias.toFixed(2)}</span>
                </div>
              </div>
              <p className={styles.sectionDescription}>{narrativeSummary}</p>
            </section>

            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{isKorean ? '?? ??' : 'Dominant Route'}</span>
              </div>
              <div className={styles.routeStack}>
                {frame.narrative.route.map((name) => (
                  <button
                    key={`route-${name}`}
                    type="button"
                    className={`${styles.routeStackItem} ${selectedNeuron === name ? styles.routeStackItemActive : ''}`}
                    onClick={() => setSelectedNeuron(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className={styles.centerPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{narrativeEyebrow}</span>
                <h2 className={styles.panelTitle}>{narrativeTitle}</h2>
                <p className={styles.panelDescription}>{narrativeSummary}</p>
              </div>
            </div>

            <div className={styles.routeRow}>
              {frame.narrative.route.map((name, index) => (
                <div key={name} className={styles.routeItem}>
                  <button type="button" className={styles.routeChip} onClick={() => setSelectedNeuron(name)}>
                    {name}
                  </button>
                  {index < frame.narrative.route.length - 1 ? (
                    <span className={styles.routeArrow} aria-hidden="true">
                      &rarr;
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className={styles.atlasStage}>
              <div className={styles.atlasCanvas}>
                <svg
                  viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                  preserveAspectRatio="xMidYMid meet"
                  className={styles.atlasSvg}
                  role="img"
                  aria-label="C. elegans connectome B atlas"
                >
                  <rect
                    x="38"
                    y="28"
                    width="172"
                    height="524"
                    rx="24"
                    fill="rgba(125, 226, 207, 0.04)"
                    stroke="rgba(125, 226, 207, 0.1)"
                  />
                  <rect
                    x="210"
                    y="28"
                    width="572"
                    height="524"
                    rx="24"
                    fill="rgba(156, 184, 255, 0.03)"
                    stroke="rgba(156, 184, 255, 0.08)"
                  />
                  <rect
                    x="782"
                    y="28"
                    width="160"
                    height="524"
                    rx="24"
                    fill="rgba(245, 201, 123, 0.04)"
                    stroke="rgba(245, 201, 123, 0.1)"
                  />

                  {frame.pathways.map((pathway) => {
                    const from = nodePoint(pathway.source);
                    const to = nodePoint(pathway.target);
                    if (!from || !to) return null;

                    const midX = (from.x + to.x) / 2;
                    const curve = Math.min(26, Math.abs(to.x - from.x) * 0.08 + Math.abs(to.y - from.y) * 0.02);
                    const midY = (from.y + to.y) / 2 - curve;

                    return (
                      <path
                        key={pathway.id}
                        d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                        stroke={pathwayStroke(pathway)}
                        strokeWidth={pathwayWidth(pathway)}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={pathway.edgeType === 'electrical' ? '5 5' : undefined}
                        opacity={pathway.edgeType === 'effective' ? 0.92 : 0.72}
                      />
                    );
                  })}

                  {connectomeBNodes.map((node) => {
                    const point = nodePoint(node.name);
                    if (!point) return null;

                    const signedActivity = frame.activities[node.name] ?? 0;
                    const effectiveInput = frame.effectiveInputs[node.name] ?? 0;
                    const isHighlighted =
                      frame.highlightedNames.includes(node.name) || node.name === selectedNeuron;
                    const radius = 2.8 + Math.abs(signedActivity) * 6.4 + (isHighlighted ? 1.2 : 0);

                    return (
                      <g key={node.name}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={radius}
                          fill={connectomeBActivityColor(signedActivity)}
                          stroke={isHighlighted ? 'rgba(255,255,255,0.92)' : connectomeBRoleColor(node.role)}
                          strokeWidth={isHighlighted ? 1.5 : 1.05}
                          opacity={0.86 + Math.min(0.14, Math.abs(effectiveInput) * 0.2)}
                          className={styles.atlasNode}
                          onClick={() => setSelectedNeuron(node.name)}
                        />
                      </g>
                    );
                  })}

                  {frame.highlightedNames.map((name) => {
                    const point = nodePoint(name);
                    if (!point) return null;
                    const anchor = point.x > VIEWBOX_WIDTH - 170 ? 'end' : 'start';
                    const dx = anchor === 'end' ? -10 : 10;
                    return (
                      <text
                        key={`label-${name}`}
                        x={point.x + dx}
                        y={point.y - 8}
                        textAnchor={anchor}
                        className={styles.svgNodeLabel}
                      >
                        {name}
                      </text>
                    );
                  })}

                  <g>
                    <text x="124" y="16" textAnchor="middle" className={styles.svgAxisLabel}>
                      {isKorean ? '?? ??' : 'Head ensemble'}
                    </text>
                    <text x="496" y="16" textAnchor="middle" className={styles.svgAxisLabel}>
                      {isKorean ? '?? ??' : 'Midbody relay'}
                    </text>
                    <text x="862" y="16" textAnchor="middle" className={styles.svgAxisLabel}>
                      {isKorean ? '?? ??' : 'Tail ensemble'}
                    </text>
                    <text x="60" y="566" className={styles.svgFootLabel}>{isKorean ? '??' : 'Head'}</text>
                    <text x="922" y="566" textAnchor="end" className={styles.svgFootLabel}>{isKorean ? '??' : 'Tail'}</text>
                  </g>
                </svg>

                <div className={styles.controlOverlay}>
                  <div className={styles.controlToolbox}>
                    <div className={styles.controlToolGroup}>
                      <ToolbarButton
                        label={running ? (isKorean ? '????' : 'Pause') : isKorean ? '??' : 'Play'}
                        icon={running ? <IconPause /> : <IconPlay />}
                        active={running}
                        onClick={() => {
                          trackEvent(running ? EVENTS.SIM_PAUSE : EVENTS.SIM_START, { view: 'connectome' });
                          setRunning(!running);
                        }}
                      />
                      <ToolbarButton
                        label={isKorean ? '???' : 'Restart'}
                        icon={<IconReset />}
                        onClick={handleReset}
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
                            onChange={(event) => setTimeScale(Number(event.target.value))}
                            className={styles.speedSlider}
                            aria-label="Simulation speed"
                          />
                          <span className={styles.speedScaleValue}>4x</span>
                        </div>
                        <span className={styles.speedFieldLabel}>{isKorean ? '속도' : 'Speed'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className={styles.rightRail}>
            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{isKorean ? '?? ?? ??' : 'Current Scene'}</span>
                <span className={styles.statePill}>{currentSceneState}</span>
              </div>
              <div className={styles.previewFrame}>
                <LabPreview simInstance={simInstance} snapshot={currentPreviewSnapshot ?? displaySnapshot} />
              </div>
            </section>

            <section className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  {isKorean ? '?? ?? ??' : 'Top Active Neurons'}
                </span>
                <span className={styles.sectionMeta}>{isKorean ? '??? ?? 8?' : 'Live top 8'}</span>
              </div>
              <div className={styles.topNeuronList}>
                {summaryNeurons.map((neuron) => (
                  <button
                    key={neuron.name}
                    type="button"
                    className={`${styles.neuronRow} ${selectedNeuron === neuron.name ? styles.neuronRowActive : ''}`}
                    onClick={() => setSelectedNeuron(neuron.name)}
                  >
                    <span className={styles.neuronName}>{neuron.name}</span>
                    <span className={styles.neuronRole}>{translateRoleLabel(neuron.label, isKorean)}</span>
                    <span className={styles.neuronActivity}>{formatSignedPercent(neuron.signedActivity)}</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedInfo ? (
              <section className={styles.infoSection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{isKorean ? '?? ??' : 'Selected Neuron'}</span>
                </div>
                <div className={styles.selectedHeader}>
                  <div>
                    <h3 className={styles.selectedName}>{selectedInfo.name}</h3>
                    <p className={styles.selectedLabel}>{translateRoleLabel(selectedInfo.label, isKorean)}</p>
                  </div>
                  <span className={styles.selectedActivity}>{formatSignedPercent(selectedInfo.signedActivity)}</span>
                </div>
                <p className={styles.selectedSummary}>{connectomeSummaryForRole(selectedInfo.role, isKorean) ?? selectedInfo.summary}</p>
                <div className={styles.selectedMetaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>{isKorean ? '??' : 'Body zone'}</span>
                    <span className={styles.metaValue}>{translateBodyZone(selectedInfo.bodyZone, isKorean)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>{isKorean ? '??' : 'Side'}</span>
                    <span className={styles.metaValue}>{translateSide(selectedInfo.side, isKorean)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>{isKorean ? '??' : 'Role'}</span>
                    <span className={styles.metaValue}>{translateRoleLabel(selectedInfo.label, isKorean)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>{isKorean ? '??' : 'Input'}</span>
                    <span className={styles.metaValue}>{formatSignedPercent(selectedInfo.effectiveInput)}</span>
                  </div>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </PageLayout>
  );
}
