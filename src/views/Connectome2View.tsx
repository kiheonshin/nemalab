import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Connectome2Atlas } from '../components/common/Connectome2Atlas';
import { PageLayout } from '../components/layout';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { trackEvent, EVENTS } from '../analytics';
import {
  buildConnectome2Frame,
  describeConnectome2Neuron,
  type Connectome2NeuronActivity,
  type Connectome2Signal,
} from '../engine/connectome2';
import type { Snapshot } from '../engine/types';
import { renderSimulation, type RenderState } from '../renderer/CanvasRenderer';
import { useStore } from '../store';
import styles from './ConnectomeView.module.css';

const DISPLAY_REFRESH_MS = 60;

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

  return <canvas ref={canvasRef} className={styles.previewCanvas} aria-label="Connectome2 preview canvas" />;
}

function SignalBar({ signal }: { signal: Connectome2Signal }) {
  return (
    <div className={styles.signalRow}>
      <div className={styles.signalHeader}>
        <span className={styles.signalLabel}>{signal.label}</span>
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

function formatState(state: Snapshot['state']) {
  switch (state) {
    case 'cruise':
      return 'Cruise';
    case 'reverse':
      return 'Reverse';
    case 'turn':
      return 'Turn';
    default:
      return 'Idle';
  }
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function Connectome2View() {
  const { t } = useTranslation();
  const simInstance = useStore((state) => state.simInstance);
  const snapshot = useStore((state) => state.snapshot);
  const simRunning = useStore((state) => state.simRunning);
  const appliedConfig = useStore((state) => state.appliedConfig);
  const appliedSeed = useStore((state) => state.appliedSeed);
  const createSimulation = useStore((state) => state.createSimulation);
  const stepSimulation = useStore((state) => state.stepSimulation);
  const resetRun = useStore((state) => state.resetRun);
  const resetSimulation = useStore((state) => state.resetSimulation);
  const updateSnapshot = useStore((state) => state.updateSnapshot);
  const showToast = useStore((state) => state.showToast);
  const mountedRef = useRef(false);
  const liveFrameRef = useRef<ReturnType<typeof buildConnectome2Frame> | null>(null);
  const liveSnapshotRef = useRef<Snapshot | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  );
  const [selectedNeuron, setSelectedNeuron] = useState('AVBL');
  const [frame, setFrame] = useState<ReturnType<typeof buildConnectome2Frame> | null>(null);
  const [displaySnapshot, setDisplaySnapshot] = useState<Snapshot | null>(null);
  const [running, setRunning] = useState(true);
  const [timeScale, setTimeScale] = useState(1);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (!simInstance) {
        createSimulation(appliedConfig, appliedSeed);
      }
    }
  }, [simInstance, createSimulation, appliedConfig, appliedSeed]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

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
    return buildConnectome2Frame(simInstance, snapshot);
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
    const detail = describeConnectome2Neuron(selectedNeuron);
    const signedActivity = frame.activities[selectedNeuron] ?? 0;
    const effectiveInput = frame.effectiveInputs[selectedNeuron] ?? 0;

    return {
      ...detail,
      signedActivity,
      activation: Math.abs(signedActivity),
      effectiveInput,
    };
  }, [frame, selectedNeuron]);

  const handleReset = () => {
    resetRun();
    resetSimulation();
    showToast(t('toast.runReset'));
  };

  const summaryNeurons: Connectome2NeuronActivity[] = frame?.topNeurons.slice(0, 8) ?? [];
  const currentPreviewSnapshot = snapshot ?? displaySnapshot;
  const currentSceneState = frame?.readout.predictedState ?? (currentPreviewSnapshot ? formatState(currentPreviewSnapshot.state) : 'Idle');
  const playbackControls = (
    <div className={styles.controlToolbox}>
      <div className={styles.controlToolGroup}>
        <ToolbarButton
          label={running ? t('lab.pause') : t('lab.play')}
          icon={running ? <IconPause /> : <IconPlay />}
          active={running}
          onClick={() => {
            trackEvent(running ? EVENTS.SIM_PAUSE : EVENTS.SIM_START, { view: 'connectome2' });
            setRunning(!running);
          }}
        />
        <ToolbarButton label={t('lab.resetRun')} icon={<IconReset />} onClick={handleReset} />
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
              aria-label={t('lab.timeScale')}
            />
            <span className={styles.speedScaleValue}>4x</span>
          </div>
          <span className={styles.speedFieldLabel}>{t('lab.timeScale')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout title="" hideHeader contentClassName={styles.pageContent}>
      {!frame || !simInstance || !displaySnapshot ? (
        <div className={styles.emptyState}>
          <h2>Preparing Connectome2</h2>
          <p>Loading the rebuilt live connectome overlay and syncing it to the current run.</p>
        </div>
      ) : (
        <div className={styles.layout}>
          {!isMobile ? (
            <aside className={styles.leftRail}>
              <section className={styles.infoSection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{t('connectome.liveInputs')}</span>
                  <span className={styles.sectionMeta}>{currentSceneState}</span>
                </div>
                <div className={styles.signalList}>
                  {frame.signals.map((signal) => (
                    <SignalBar key={signal.key} signal={signal} />
                  ))}
                </div>
              </section>

              <section className={styles.infoSection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{t('connectome.behaviorSnapshot')}</span>
                </div>
                <div className={styles.metricGrid}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricCardLabel}>Food proximity</span>
                    <span className={styles.metricCardValue}>{Math.round(frame.foodProximity * 100)}%</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricCardLabel}>Speed</span>
                    <span className={styles.metricCardValue}>{displaySnapshot.speed.toFixed(1)} u/s</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricCardLabel}>Elapsed</span>
                    <span className={styles.metricCardValue}>{displaySnapshot.metrics.elapsed.toFixed(1)} s</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricCardLabel}>Readout</span>
                    <span className={styles.metricCardValue}>{frame.readout.predictedState}</span>
                  </div>
                </div>
                <p className={styles.sectionDescription}>{frame.narrative.summary}</p>
              </section>

              <section className={styles.infoSection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{t('connectome.dominantRoute')}</span>
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
          ) : null}

          <section className={styles.centerPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{t('connectome.liveSensorimotorOverlay')}</span>
                <h2 className={styles.panelTitle}>{frame.narrative.title}</h2>
                <p className={styles.panelDescription}>{frame.narrative.summary}</p>
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
                <Connectome2Atlas
                  frame={frame}
                  selectedNeuron={selectedNeuron}
                  setSelectedNeuron={setSelectedNeuron}
                  wrapperClassName={styles.atlasViewport}
                  enablePan
                  classNames={{
                    svg: styles.atlasSvg,
                    node: styles.atlasNode,
                    nodeLabel: styles.svgNodeLabel,
                    axisLabel: styles.svgAxisLabel,
                    footLabel: styles.svgFootLabel,
                  }}
                  ariaLabel="C. elegans connectome2 atlas"
                />

                <div className={styles.controlOverlay}>{playbackControls}</div>
              </div>
            </div>

          </section>

          {!isMobile ? (
            <aside className={styles.rightRail}>
              <section className={`${styles.infoSection} ${styles.scenePreviewSection}`}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{t('connectome.environmentSimulation')}</span>
                  <span className={styles.statePill}>{currentSceneState}</span>
                </div>
                <div className={styles.previewFrame}>
                  <LabPreview simInstance={simInstance} snapshot={currentPreviewSnapshot ?? displaySnapshot} />
                </div>
              </section>

              <section className={`${styles.infoSection} ${styles.topActiveSection}`}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{t('connectome.topActiveNeurons')}</span>
                  <span className={styles.sectionMeta}>Live top 8</span>
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
                      <span className={styles.neuronRole}>{neuron.label}</span>
                      <span className={styles.neuronActivity}>{formatSignedPercent(neuron.signedActivity)}</span>
                    </button>
                  ))}
                </div>
              </section>

              {selectedInfo ? (
                <section className={`${styles.infoSection} ${styles.selectedNeuronSection}`}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>{t('connectome.selectedNeuron')}</span>
                  </div>
                  <div className={styles.selectedHeader}>
                    <div>
                      <h3 className={styles.selectedName}>{selectedInfo.name}</h3>
                      <p className={styles.selectedLabel}>{selectedInfo.label}</p>
                    </div>
                    <span className={styles.selectedActivity}>{formatSignedPercent(selectedInfo.signedActivity)}</span>
                  </div>
                  <p className={styles.selectedSummary}>{selectedInfo.summary}</p>
                  <div className={styles.selectedMetaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Body zone</span>
                      <span className={styles.metaValue}>{selectedInfo.bodyZone}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Side</span>
                      <span className={styles.metaValue}>{selectedInfo.side}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Role</span>
                      <span className={styles.metaValue}>{selectedInfo.label}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Input</span>
                      <span className={styles.metaValue}>{formatSignedPercent(selectedInfo.effectiveInput)}</span>
                    </div>
                  </div>
                </section>
              ) : null}
            </aside>
          ) : null}

          {isMobile ? (
            <>
              <aside className={`${styles.leftRail} ${styles.mobileFlowPanel}`}>
                <section className={styles.infoSection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>{t('connectome.liveInputs')}</span>
                    <span className={styles.sectionMeta}>{currentSceneState}</span>
                  </div>
                  <div className={styles.signalList}>
                    {frame.signals.map((signal) => (
                      <SignalBar key={`mobile-signal-${signal.key}`} signal={signal} />
                    ))}
                  </div>
                </section>
              </aside>

              {selectedInfo ? (
                <aside className={`${styles.rightRail} ${styles.mobileFlowPanel}`}>
                  <section className={`${styles.infoSection} ${styles.selectedNeuronSection}`}>
                    <div className={styles.sectionHeader}>
                      <span className={styles.sectionTitle}>{t('connectome.selectedNeuron')}</span>
                    </div>
                    <div className={styles.selectedHeader}>
                      <div>
                        <h3 className={styles.selectedName}>{selectedInfo.name}</h3>
                        <p className={styles.selectedLabel}>{selectedInfo.label}</p>
                      </div>
                      <span className={styles.selectedActivity}>{formatSignedPercent(selectedInfo.signedActivity)}</span>
                    </div>
                    <p className={styles.selectedSummary}>{selectedInfo.summary}</p>
                    <div className={styles.selectedMetaGrid}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Body zone</span>
                        <span className={styles.metaValue}>{selectedInfo.bodyZone}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Side</span>
                        <span className={styles.metaValue}>{selectedInfo.side}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Role</span>
                        <span className={styles.metaValue}>{selectedInfo.label}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Input</span>
                        <span className={styles.metaValue}>{formatSignedPercent(selectedInfo.effectiveInput)}</span>
                      </div>
                    </div>
                  </section>
                </aside>
              ) : null}

              <aside className={`${styles.leftRail} ${styles.mobileFlowPanel}`}>
                <section className={styles.infoSection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>{t('connectome.behaviorSnapshot')}</span>
                  </div>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricCard}>
                      <span className={styles.metricCardLabel}>Food proximity</span>
                      <span className={styles.metricCardValue}>{Math.round(frame.foodProximity * 100)}%</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricCardLabel}>Speed</span>
                      <span className={styles.metricCardValue}>{displaySnapshot.speed.toFixed(1)} u/s</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricCardLabel}>Elapsed</span>
                      <span className={styles.metricCardValue}>{displaySnapshot.metrics.elapsed.toFixed(1)} s</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricCardLabel}>Readout</span>
                      <span className={styles.metricCardValue}>{frame.readout.predictedState}</span>
                    </div>
                  </div>
                  <p className={styles.sectionDescription}>{frame.narrative.summary}</p>
                </section>
              </aside>

              <aside className={`${styles.leftRail} ${styles.mobileFlowPanel}`}>
                <section className={styles.infoSection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>{t('connectome.dominantRoute')}</span>
                  </div>
                  <div className={styles.routeStack}>
                    {frame.narrative.route.map((name) => (
                      <button
                        key={`mobile-route-${name}`}
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

              <aside className={`${styles.rightRail} ${styles.mobileTopActivePanel}`}>
              <section className={`${styles.infoSection} ${styles.topActiveSection}`}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{t('connectome.topActiveNeurons')}</span>
                  <span className={styles.sectionMeta}>Live top 8</span>
                </div>
                <div className={styles.topNeuronList}>
                  {summaryNeurons.map((neuron) => (
                    <button
                      key={`mobile-${neuron.name}`}
                      type="button"
                      className={`${styles.neuronRow} ${selectedNeuron === neuron.name ? styles.neuronRowActive : ''}`}
                      onClick={() => setSelectedNeuron(neuron.name)}
                    >
                      <span className={styles.neuronName}>{neuron.name}</span>
                      <span className={styles.neuronRole}>{neuron.label}</span>
                      <span className={styles.neuronActivity}>{formatSignedPercent(neuron.signedActivity)}</span>
                    </button>
                  ))}
                </div>
              </section>
              </aside>
            </>
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}
