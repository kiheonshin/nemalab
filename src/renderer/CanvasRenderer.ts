// ============================================================================
// Canvas Renderer — Ported from original app.js render() (lines 706–961)
// Pure rendering function, no DOM/React dependencies.
// ============================================================================

import type {
  WormState,
  World,
  SimConfig,
  SamplePoints,
  SimEvent,
  RawMetrics,
  Point,
} from '../engine/types';
import { clamp } from '../engine/math';
import { WORLD_SIZE } from '../engine/constants';
import { syncCanvasForHiDPI } from './hiDPI';

// ---------------------------------------------------------------------------
// Render State — everything the renderer needs from the simulation
// ---------------------------------------------------------------------------

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface RenderState {
  worm: WormState;
  world: World;
  config: SimConfig;
  samplePoints: SamplePoints;
  eventMarkers: SimEvent[];
  metrics: RawMetrics;
  highlightCues: Record<string, number>;
  previewCue: { type: string; until: number } | null;
  camera?: Camera;
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

interface CanvasBounds {
  width: number;
  height: number;
  pad: number;
}

function canvasBounds(canvas: HTMLCanvasElement): CanvasBounds {
  const rect = canvas.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    pad: 0,
  };
}

function worldToScreen(
  point: { x: number; y: number },
  bounds: CanvasBounds,
): { x: number; y: number } {
  const drawableWidth = bounds.width - bounds.pad * 2;
  const drawableHeight = bounds.height - bounds.pad * 2;
  return {
    x: bounds.pad + (point.x / WORLD_SIZE) * drawableWidth,
    y: bounds.pad + (point.y / WORLD_SIZE) * drawableHeight,
  };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderSimulation(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: RenderState,
): void {
  syncCanvasForHiDPI(canvas);
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const cfg = state.config;
  const visuals = cfg.visuals;
  const bounds = canvasBounds(canvas);
  const { width, height, pad } = bounds;
  const worldTopLeft = { x: pad, y: pad };
  const worldWidth = width - pad * 2;
  const worldHeight = height - pad * 2;
  const { frontPoint, leftPoint, rightPoint } = state.samplePoints;
  const cueTouch = state.highlightCues.touch || 0;
  const cueChemo = state.highlightCues.chemo || 0;
  const cueThermo = state.highlightCues.thermo || 0;
  const previewType =
    state.previewCue && state.previewCue.until > performance.now()
      ? state.previewCue.type
      : null;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);

  const w2s = (p: { x: number; y: number }) => worldToScreen(p, bounds);

  // --- Background ---
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, 'rgba(10,14,20,0.98)');
  bgGradient.addColorStop(1, 'rgba(8,12,18,1)');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // --- Camera tracking transform ---
  if (state.camera) {
    const cam = state.camera;
    const centerScreen = w2s({ x: cam.x, y: cam.y });
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.rotate(-cam.rotation);
    ctx.translate(-centerScreen.x, -centerScreen.y);
  }

  // --- World border ---
  if (!visuals.cleanMode) {
    ctx.strokeStyle = 'rgba(168, 184, 216, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
  }

  // --- Touch cue border ---
  if (cueTouch > 0.01 || previewType === 'touch') {
    ctx.strokeStyle = `rgba(245, 201, 123, ${
      0.16 + cueTouch * 0.42 + (previewType === 'touch' ? 0.18 : 0)
    })`;
    ctx.lineWidth = 2 + cueTouch * 2.4;
    ctx.shadowColor = 'rgba(245, 201, 123, 0.26)';
    ctx.shadowBlur =
      16 * Math.max(cueTouch, previewType === 'touch' ? 0.55 : 0);
    ctx.strokeRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
    ctx.shadowBlur = 0;
  }

  // --- Chemical overlay ---
  const showChemicalOverlay =
    visuals.showChemicalOverlay ||
    previewType === 'chemo' ||
    cueChemo > 0.01;
  if (showChemicalOverlay) {
    const foodScreen = w2s(state.world.food);
    const maxRadius =
      (state.world.food.radius / WORLD_SIZE) *
      Math.max(worldWidth, worldHeight) *
      4.6;
    const cueBoost =
      cueChemo * 0.22 + (previewType === 'chemo' ? 0.18 : 0);
    const gradient = ctx.createRadialGradient(
      foodScreen.x,
      foodScreen.y,
      0,
      foodScreen.x,
      foodScreen.y,
      maxRadius,
    );
    gradient.addColorStop(
      0,
      `rgba(122, 242, 176, ${
        0.24 * visuals.overlayOpacity + 0.08 + cueBoost
      })`,
    );
    gradient.addColorStop(
      0.3,
      `rgba(110, 217, 165, ${
        0.12 * visuals.overlayOpacity + 0.04 + cueBoost * 0.5
      })`,
    );
    gradient.addColorStop(1, 'rgba(80, 140, 110, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
  }

  // --- Temperature overlay ---
  const showTemperatureOverlay =
    (cfg.world.temperatureMode !== 'none' && visuals.showTemperatureOverlay) ||
    previewType === 'thermo' ||
    cueThermo > 0.01;
  if (showTemperatureOverlay) {
    const renderMode =
      cfg.world.temperatureMode !== 'none'
        ? cfg.world.temperatureMode
        : 'linear';
    const cueAlpha =
      cueThermo * 0.18 + (previewType === 'thermo' ? 0.16 : 0);
    ctx.globalAlpha = clamp(visuals.overlayOpacity + 0.06 + cueAlpha, 0, 1);
    if (renderMode === 'linear') {
      const grad = ctx.createLinearGradient(
        worldTopLeft.x,
        worldTopLeft.y,
        worldTopLeft.x + worldWidth,
        worldTopLeft.y,
      );
      grad.addColorStop(0, 'rgba(80,120,255,0.14)');
      grad.addColorStop(0.5, 'rgba(124,168,255,0.03)');
      grad.addColorStop(1, 'rgba(255,176,96,0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
      const prefX =
        worldTopLeft.x + worldWidth * cfg.world.preferredTemperature;
      ctx.strokeStyle = `rgba(214, 229, 255, ${
        0.34 +
        cueThermo * 0.28 +
        (previewType === 'thermo' ? 0.18 : 0)
      })`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(prefX, worldTopLeft.y);
      ctx.lineTo(prefX, worldTopLeft.y + worldHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const hotspot = w2s(state.world.temperatureHotspot);
      const radial = ctx.createRadialGradient(
        hotspot.x,
        hotspot.y,
        0,
        hotspot.x,
        hotspot.y,
        Math.max(worldWidth, worldHeight) * 0.62,
      );
      radial.addColorStop(0, 'rgba(255,185,98,0.18)');
      radial.addColorStop(0.35, 'rgba(163,186,255,0.08)');
      radial.addColorStop(1, 'rgba(90,118,255,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
      if (cueThermo > 0.01 || previewType === 'thermo') {
        ctx.beginPath();
        ctx.arc(hotspot.x, hotspot.y, 42 + pulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(210, 227, 255, ${
          0.3 +
          cueThermo * 0.28 +
          (previewType === 'thermo' ? 0.18 : 0)
        })`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- Food patch ---
  const foodCenter = w2s(state.world.food);
  const foodScreenRadius =
    (state.world.food.radius / WORLD_SIZE) *
    Math.min(worldWidth, worldHeight) *
    1.1;
  ctx.fillStyle = 'rgba(95, 196, 146, 0.16)';
  ctx.beginPath();
  ctx.arc(foodCenter.x, foodCenter.y, foodScreenRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(146, 243, 185, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (cueChemo > 0.01 || previewType === 'chemo') {
    ctx.beginPath();
    ctx.arc(
      foodCenter.x,
      foodCenter.y,
      (state.world.food.radius / WORLD_SIZE) *
        Math.min(worldWidth, worldHeight) *
        (1.42 + pulse * 0.08),
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = `rgba(166, 255, 205, ${
      0.28 +
      cueChemo * 0.36 +
      (previewType === 'chemo' ? 0.18 : 0)
    })`;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(122, 242, 176, 0.28)';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- Obstacles ---
  state.world.obstacles.forEach((obstacle) => {
    const point = w2s(obstacle);
    const radius =
      (obstacle.r / WORLD_SIZE) * Math.min(worldWidth, worldHeight);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle =
      cueTouch > 0.01 || previewType === 'touch'
        ? `rgba(116, 126, 144, ${
            0.18 +
            cueTouch * 0.1 +
            (previewType === 'touch' ? 0.06 : 0)
          })`
        : 'rgba(116, 126, 144, 0.16)';
    ctx.fill();
    ctx.strokeStyle =
      cueTouch > 0.01 || previewType === 'touch'
        ? `rgba(255, 221, 154, ${
            0.28 +
            cueTouch * 0.34 +
            (previewType === 'touch' ? 0.12 : 0)
          })`
        : 'rgba(161, 173, 193, 0.18)';
    ctx.lineWidth = cueTouch > 0.01 || previewType === 'touch' ? 2 : 1;
    ctx.stroke();
  });

  // --- Trail ---
  if (visuals.showTrail && state.worm.trail.length > 1) {
    ctx.beginPath();
    state.worm.trail.forEach((point: Point, index: number) => {
      const screen = w2s(point);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.strokeStyle = 'rgba(130, 205, 190, 0.24)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // --- Event markers ---
  if (visuals.showEventMarkers) {
    state.eventMarkers.slice(0, 20).forEach((event, index) => {
      const point = w2s(event);
      const alpha = clamp(0.45 - index * 0.02, 0.1, 0.45);
      const color =
        event.type === 'collision'
          ? `rgba(255, 140, 140, ${alpha})`
          : event.type === 'turn'
            ? `rgba(255, 204, 116, ${alpha})`
            : `rgba(125, 226, 207, ${alpha})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4.4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // --- Worm body with sinusoidal wave ---
  const segmentPoints = state.worm.segments.map((segment, index, arr) => {
    const base = w2s(segment);
    const prev = arr[Math.max(0, index - 1)];
    const next = arr[Math.min(arr.length - 1, index + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.hypot(dx, dy) || 1;
    const px = -dy / length;
    const py = dx / length;
    const amplitude =
      (state.worm.state === 'turn' ? 5.2 : 3.4) *
      (1 - (index / arr.length) * 0.92);
    const direction = state.worm.state === 'reverse' ? -1 : 1;
    const wave =
      Math.sin(state.metrics.elapsed * 10 * direction - index * 0.68) *
      amplitude;
    return {
      x: base.x + px * wave,
      y: base.y + py * wave,
    };
  });

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  segmentPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle =
    state.worm.state === 'reverse'
      ? 'rgba(245, 201, 123, 0.95)'
      : state.worm.state === 'turn'
        ? 'rgba(255, 160, 160, 0.96)'
        : 'rgba(126, 226, 207, 0.96)';
  ctx.lineWidth = clamp(
    4.4 + state.config.worm.segmentCount * 0.13,
    6,
    10.5,
  );
  ctx.shadowColor = 'rgba(76, 178, 163, 0.22)';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- Head ---
  const head = segmentPoints[0];
  if (head) {
    ctx.beginPath();
    ctx.arc(head.x, head.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(242, 247, 255, 0.9)';
    ctx.fill();
  }

  // --- Sensor points ---
  const showSensorPoints =
    visuals.showSensors ||
    cueTouch > 0.01 ||
    cueChemo > 0.01 ||
    cueThermo > 0.01 ||
    Boolean(previewType);

  if (showSensorPoints) {
    const headWorld = w2s({ x: state.worm.x, y: state.worm.y });

    // Sensor guide lines
    if (
      cueChemo > 0.01 ||
      cueTouch > 0.01 ||
      cueThermo > 0.01 ||
      previewType
    ) {
      [leftPoint, rightPoint, frontPoint].forEach((point) => {
        const screen = w2s(point);
        ctx.beginPath();
        ctx.moveTo(headWorld.x, headWorld.y);
        ctx.lineTo(screen.x, screen.y);
        const guideColor =
          previewType === 'touch'
            ? `rgba(255, 221, 154, ${0.26 + pulse * 0.22})`
            : previewType === 'thermo'
              ? `rgba(190, 213, 255, ${0.24 + pulse * 0.18})`
              : `rgba(166, 255, 205, ${0.24 + pulse * 0.18})`;
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // Sensor dots
    const sensorDots: Array<{
      point: { x: number; y: number };
      color: string;
    }> = [
      {
        point: leftPoint,
        color:
          previewType === 'chemo' || cueChemo > 0.01
            ? `rgba(166, 255, 205, ${0.76 + pulse * 0.12})`
            : previewType === 'thermo' || cueThermo > 0.01
              ? `rgba(190, 213, 255, ${0.76 + pulse * 0.12})`
              : 'rgba(156, 184, 255, 0.9)',
      },
      {
        point: rightPoint,
        color:
          previewType === 'chemo' || cueChemo > 0.01
            ? `rgba(166, 255, 205, ${0.76 + pulse * 0.12})`
            : previewType === 'thermo' || cueThermo > 0.01
              ? `rgba(190, 213, 255, ${0.76 + pulse * 0.12})`
              : 'rgba(156, 184, 255, 0.9)',
      },
      {
        point: frontPoint,
        color:
          previewType === 'touch' || cueTouch > 0.01
            ? `rgba(255, 221, 154, ${0.76 + pulse * 0.12})`
            : previewType === 'thermo' || cueThermo > 0.01
              ? `rgba(190, 213, 255, ${0.76 + pulse * 0.12})`
              : 'rgba(245, 201, 123, 0.9)',
      },
    ];

    const hasCue =
      cueTouch > 0.01 ||
      cueChemo > 0.01 ||
      cueThermo > 0.01 ||
      Boolean(previewType);
    sensorDots.forEach(({ point, color }) => {
      const screen = w2s(point);
      ctx.beginPath();
      ctx.arc(
        screen.x,
        screen.y,
        hasCue ? 5.2 + pulse * 0.6 : 4.2,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = hasCue ? 16 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  // --- Restore camera transform ---
  if (state.camera) {
    ctx.restore();
  }
}
