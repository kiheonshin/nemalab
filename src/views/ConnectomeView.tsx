import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common';
import { PageLayout } from '../components/layout';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { trackEvent, EVENTS } from '../analytics';
import { cElegans302Atlas } from '../data/cElegans302Atlas';
import {
  buildConnectomeFrame,
  describeConnectomeNeuron,
  type ConnectomeNeuronActivity,
  type ConnectomeSignal,
} from '../engine/connectome';
import { useStore } from '../store';
import styles from './ConnectomeView.module.css';

const VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 580;
const PADDING_X = 78;
const PADDING_Y = 76;
const BODY_WIDTH = VIEWBOX_WIDTH - PADDING_X * 2;
const BODY_HEIGHT = VIEWBOX_HEIGHT - PADDING_Y * 2;

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

function SignalBar({ signal }: { signal: ConnectomeSignal }) {
  return (
    <div className={styles.signalRow}>
      <div className={styles.signalHeader}>
        <span className={styles.signalLabel}>{signal.label}</span>
        <span className={styles.signalMeta}>
          {Math.round(signal.value * 100)}%
          {signal.polarity === 'left'
            ? ' · L'
            : signal.polarity === 'right'
              ? ' · R'
              : ''}
        </span>
      </div>
      <div className={styles.signalTrack}>
        <div
          className={styles.signalFill}
          style={{ width: `${Math.max(6, signal.value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function neuronPoint(name: string) {
  const entry = cElegans302Atlas.find((item) => item.name === name);
  if (!entry) return null;

  return {
    x: PADDING_X + entry.projection.dorsal.x * BODY_WIDTH,
    y: PADDING_Y + entry.projection.dorsal.y * BODY_HEIGHT,
    entry,
  };
}

function connectionColor(family: 'sensory' | 'integration' | 'motor') {
  if (family === 'sensory') return 'rgba(125, 226, 207, 0.82)';
  if (family === 'integration') return 'rgba(156, 184, 255, 0.82)';
  return 'rgba(245, 201, 123, 0.88)';
}

export function ConnectomeView() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const simInstance = useStore((s) => s.simInstance);
  const snapshot = useStore((s) => s.snapshot);
  const simRunning = useStore((s) => s.simRunning);
  const appliedConfig = useStore((s) => s.appliedConfig);
  const appliedSeed = useStore((s) => s.appliedSeed);
  const running = useStore((s) => s.running);
  const timeScale = useStore((s) => s.timeScale);
  const createSimulation = useStore((s) => s.createSimulation);
  const stepSimulation = useStore((s) => s.stepSimulation);
  const setRunning = useStore((s) => s.setRunning);
  const setTimeScale = useStore((s) => s.setTimeScale);
  const resetRun = useStore((s) => s.resetRun);
  const resetSimulation = useStore((s) => s.resetSimulation);
  const updateSnapshot = useStore((s) => s.updateSnapshot);
  const showToast = useStore((s) => s.showToast);
  const isKorean = i18n.language.startsWith('ko');
  const mountedRef = useRef(false);
  const [selectedNeuron, setSelectedNeuron] = useState<string>('AVBL');

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

  const frame = useMemo(() => {
    if (!simInstance || !snapshot) return null;
    return buildConnectomeFrame(simInstance, snapshot);
  }, [simInstance, snapshot]);

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
    const entry = cElegans302Atlas.find((item) => item.name === selectedNeuron);

    return {
      ...detail,
      entry,
      activation: frame.activities[selectedNeuron] ?? active?.activation ?? 0,
    };
  }, [frame, selectedNeuron]);

  const stateLabel = frame
    ? frame.state === 'cruise'
      ? isKorean
        ? '전진'
        : 'Cruise'
      : frame.state === 'reverse'
        ? isKorean
          ? '후진'
          : 'Reverse'
        : isKorean
          ? '회전'
          : 'Turn'
    : isKorean
      ? '대기'
      : 'Idle';

  const title = 'Connectome';
  const eyebrow = isKorean ? '실험 회로' : 'Experimental Circuit';
  const description = isKorean
    ? '현재 Lab 시뮬레이션의 센서, 상태, 환경 값을 바탕으로 302개 뉴런 atlas 위에 감각-인터뉴런-운동 회로를 실시간 투영합니다.'
    : 'Projects the current Lab simulation onto the 302-neuron atlas, mapping sensory input into interneuron and motor activity in real time.';

  const handleReset = () => {
    resetRun();
    resetSimulation();
    showToast(isKorean ? 'Connectome 실험을 다시 시작했습니다.' : 'Connectome experiment restarted.');
  };

  const summaryNeurons: ConnectomeNeuronActivity[] = frame?.topNeurons ?? [];

  return (
    <PageLayout
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <div className={styles.toolbar}>
          <ToolbarButton
            label={running ? (isKorean ? '일시정지' : 'Pause') : isKorean ? '재생' : 'Play'}
            icon={running ? <IconPause /> : <IconPlay />}
            active={running}
            onClick={() => {
              trackEvent(running ? EVENTS.SIM_PAUSE : EVENTS.SIM_START, { view: 'connectome' });
              setRunning(!running);
            }}
          />
          <ToolbarButton
            label={isKorean ? '재시작' : 'Restart'}
            icon={<IconReset />}
            onClick={handleReset}
          />
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
                  aria-label={isKorean ? '시뮬레이션 속도' : 'Simulation speed'}
                />
                <span className={styles.speedScaleValue}>4x</span>
              </div>
              <span className={styles.speedFieldLabel}>{isKorean ? '속도' : 'Speed'}</span>
            </div>
          </div>
          <Button variant="ghost" size="small" onClick={() => navigate('/')}>
            {isKorean ? 'Lab로 이동' : 'Open Lab'}
          </Button>
        </div>
      }
      contentClassName={styles.pageContent}
    >
      {!frame ? (
        <div className={styles.emptyState}>
          <h2>{isKorean ? 'Connectome 준비 중' : 'Preparing Connectome'}</h2>
          <p>
            {isKorean
              ? '실험용 회로 시뮬레이션을 초기화하고 있습니다.'
              : 'Initializing the experimental connectome layer.'}
          </p>
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.atlasPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>
                  {isKorean ? '302개 뉴런 atlas' : '302-neuron atlas'}
                </span>
                <h2 className={styles.panelTitle}>{frame.narrative.title}</h2>
                <p className={styles.panelDescription}>{frame.narrative.summary}</p>
              </div>
              <div className={styles.stateCluster}>
                <span className={styles.statePill}>{stateLabel}</span>
                <span className={styles.stateMeta}>
                  {isKorean ? '먹이 근접도' : 'Food proximity'} {Math.round(frame.foodProximity * 100)}%
                </span>
              </div>
            </div>

            <div className={styles.routeRow}>
              {frame.narrative.route.map((name, index) => (
                <div key={name} className={styles.routeItem}>
                  <button type="button" className={styles.routeChip} onClick={() => setSelectedNeuron(name)}>
                    {name}
                  </button>
                  {index < frame.narrative.route.length - 1 ? <span className={styles.routeArrow}>→</span> : null}
                </div>
              ))}
            </div>

            <div className={styles.atlasCanvas}>
              <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className={styles.atlasSvg}
                role="img"
                aria-label={isKorean ? '예쁜꼬마선충 connectome atlas' : 'C. elegans connectome atlas'}
              >
                <defs>
                  <linearGradient id="connectomeBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(8, 13, 20, 0.98)" />
                    <stop offset="100%" stopColor="rgba(14, 20, 31, 0.92)" />
                  </linearGradient>
                </defs>
                <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} rx="28" fill="url(#connectomeBg)" />

                <rect x="54" y="54" width="250" height="472" rx="26" fill="rgba(125, 226, 207, 0.04)" stroke="rgba(125, 226, 207, 0.12)" />
                <rect x="304" y="54" width="392" height="472" rx="26" fill="rgba(156, 184, 255, 0.03)" stroke="rgba(156, 184, 255, 0.10)" />
                <rect x="696" y="54" width="230" height="472" rx="26" fill="rgba(245, 201, 123, 0.04)" stroke="rgba(245, 201, 123, 0.10)" />

                <text x="82" y="92" className={styles.svgAxisLabel}>Head sensory ring</text>
                <text x="336" y="92" className={styles.svgAxisLabel}>Integration + command</text>
                <text x="726" y="92" className={styles.svgAxisLabel}>Motor output</text>
                <text x="80" y="546" className={styles.svgFootLabel}>{isKorean ? 'Head' : 'Head'}</text>
                <text x="902" y="546" textAnchor="end" className={styles.svgFootLabel}>
                  {isKorean ? 'Tail' : 'Tail'}
                </text>

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
                  const y = PADDING_Y + entry.projection.dorsal.y * BODY_HEIGHT;
                  const activation = frame.activities[entry.name] ?? 0;
                  const isHighlighted = frame.highlightedNames.includes(entry.name) || entry.name === selectedNeuron;
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
                    <g key={entry.name}>
                      <circle
                        cx={x}
                        cy={y}
                        r={radius}
                        fill={fill}
                        stroke={isHighlighted ? 'rgba(255,255,255,0.92)' : 'rgba(6,8,12,0.92)'}
                        strokeWidth={isHighlighted ? 1.4 : 0.7}
                        className={styles.atlasNode}
                        onClick={() => setSelectedNeuron(entry.name)}
                      />
                    </g>
                  );
                })}

                {frame.highlightedNames.map((name) => {
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
                      className={styles.svgNodeLabel}
                    >
                      {name}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div className={styles.footNote}>
              {isKorean
                ? '이 화면은 현재 Lab 상태를 302개 뉴런 atlas 위에 투영한 실험적 해석 레이어입니다. 실제 전 뉴런 생체기록을 직접 재현하는 모델은 아닙니다.'
                : 'This screen is an experimental interpretive layer that projects the current Lab state onto the 302-neuron atlas, not a full measured pan-neuronal recording model.'}
            </div>
          </section>

          <aside className={styles.sideRail}>
            <section className={styles.infoPanel}>
              <span className={styles.infoEyebrow}>{isKorean ? '실시간 입력' : 'Live Inputs'}</span>
              <h3 className={styles.infoTitle}>{isKorean ? '외부 자극과 내부 구동력' : 'Stimuli and internal drives'}</h3>
              <div className={styles.signalList}>
                {frame.signals.map((signal) => (
                  <SignalBar key={signal.key} signal={signal} />
                ))}
              </div>
            </section>

            <section className={styles.infoPanel}>
              <span className={styles.infoEyebrow}>{isKorean ? '활성 회로' : 'Active circuit'}</span>
              <h3 className={styles.infoTitle}>{isKorean ? '현재 우세 경로' : 'Dominant route'}</h3>
              <div className={styles.routeStack}>
                {frame.narrative.route.map((name) => (
                  <button
                    key={`stack-${name}`}
                    type="button"
                    className={`${styles.routeStackItem} ${selectedNeuron === name ? styles.routeStackItemActive : ''}`}
                    onClick={() => setSelectedNeuron(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.infoPanel}>
              <span className={styles.infoEyebrow}>{isKorean ? '상위 활성 뉴런' : 'Top active neurons'}</span>
              <h3 className={styles.infoTitle}>{isKorean ? '실시간 상위 14개' : 'Live top 14'}</h3>
              <div className={styles.topNeuronList}>
                {summaryNeurons.map((neuron) => (
                  <button
                    key={neuron.name}
                    type="button"
                    className={`${styles.neuronRow} ${selectedNeuron === neuron.name ? styles.neuronRowActive : ''}`}
                    onClick={() => setSelectedNeuron(neuron.name)}
                  >
                    <span className={styles.neuronName}>{neuron.name}</span>
                    <span className={styles.neuronRole}>{neuron.label}</span>
                    <span className={styles.neuronActivity}>{Math.round(neuron.activation * 100)}%</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedInfo ? (
              <section className={styles.infoPanel}>
                <span className={styles.infoEyebrow}>{isKorean ? '선택 뉴런' : 'Selected neuron'}</span>
                <div className={styles.selectedHeader}>
                  <div>
                    <h3 className={styles.selectedName}>{selectedInfo.name}</h3>
                    <p className={styles.selectedLabel}>{selectedInfo.label}</p>
                  </div>
                  <span className={styles.selectedActivity}>{Math.round(selectedInfo.activation * 100)}%</span>
                </div>
                <p className={styles.selectedSummary}>{selectedInfo.summary}</p>
                {selectedInfo.entry ? (
                  <div className={styles.selectedMetaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>{isKorean ? 'Ganglion' : 'Ganglion'}</span>
                      <span className={styles.metaValue}>{selectedInfo.entry.ganglion}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>{isKorean ? '영역' : 'Region'}</span>
                      <span className={styles.metaValue}>{selectedInfo.entry.region}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>{isKorean ? '계열' : 'Family'}</span>
                      <span className={styles.metaValue}>{selectedInfo.entry.family}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>{isKorean ? '측성' : 'Side'}</span>
                      <span className={styles.metaValue}>{selectedInfo.entry.side}</span>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </PageLayout>
  );
}
