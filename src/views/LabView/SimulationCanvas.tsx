// ============================================================================
// SimulationCanvas — Canvas element that renders the worm simulation
// ============================================================================

import { useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { renderSimulation, type RenderState, type Camera } from '../../renderer/CanvasRenderer';
import styles from '../LabView.module.css';

export function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simInstance = useStore((s) => s.simInstance);
  const snapshot = useStore((s) => s.snapshot);
  const running = useStore((s) => s.running);
  const trackingMode = useStore((s) => s.trackingMode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simInstance) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const internalState = simInstance.getState();

    let camera: Camera | undefined;
    if (trackingMode) {
      const worm = internalState.worm;
      // Calculate heading from first two segments
      let rotation = 0;
      if (worm.segments.length >= 2) {
        const head = worm.segments[0];
        const neck = worm.segments[1];
        rotation = Math.atan2(head.y - neck.y, head.x - neck.x) - Math.PI / 2;
      }
      camera = {
        x: worm.x,
        y: worm.y,
        zoom: 3.1,
        rotation,
      };
    }

    const renderState: RenderState = {
      worm: internalState.worm,
      world: internalState.world,
      config: simInstance.getConfig(),
      samplePoints: simInstance.getSamplePoints(),
      eventMarkers: internalState.eventMarkers,
      metrics: internalState.metrics,
      highlightCues: {},
      previewCue: null,
      camera,
    };

    renderSimulation(ctx, canvas, renderState);
  }, [simInstance, snapshot, running, trackingMode]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
    />
  );
}
