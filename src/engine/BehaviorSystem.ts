// ============================================================================
// Nema Lab Simulation Engine — Behavior System
// Pure TypeScript, zero browser/DOM/Canvas dependencies
//
// Implements the state machine (cruise / reverse / turn) and movement logic.
// All transition rules, bias calculations, and physics preserved from app.js.
// ============================================================================

import type {
  Point,
  SimConfig,
  World,
  WormState,
  SensorState,
  SamplePoints,
  RawMetrics,
  SimEvent,
  CollisionResult,
} from './types';
import { clamp, lerp } from './math';
import {
  computeSamplePoints,
  sampleFood,
  sampleTemperature,
  detectCollision,
} from './SensorSystem';
import { MAX_RECENT_EVENTS, MAX_EVENT_MARKERS } from './constants';

// ---------------------------------------------------------------------------
// Types local to behavior stepping
// ---------------------------------------------------------------------------

export interface StepContext {
  config: SimConfig;
  world: World;
  worm: WormState;
  sensor: SensorState;
  metrics: RawMetrics;
  recentEvents: SimEvent[];
  eventMarkers: SimEvent[];
  prevChemo: number;
  wasInsideFood: boolean;
  /** The RNG closure — mutated on each call. */
  rand: () => number;
}

export interface StepResult {
  /** Updated previous chemo value for temporal comparison. */
  prevChemo: number;
  /** Updated flag: was the worm inside the food patch? */
  wasInsideFood: boolean;
  /** Updated sample points (for renderer). */
  samplePoints: SamplePoints;
}

// ---------------------------------------------------------------------------
// Event Helpers
// ---------------------------------------------------------------------------

function pushEvent(
  ctx: StepContext,
  type: SimEvent['type'],
  title: string,
): void {
  const event: SimEvent = {
    type,
    title,
    time: ctx.metrics.elapsed,
    x: ctx.worm ? ctx.worm.x : 0,
    y: ctx.worm ? ctx.worm.y : 0,
  };
  ctx.recentEvents.unshift(event);
  ctx.recentEvents = ctx.recentEvents.slice(0, MAX_RECENT_EVENTS);
  ctx.eventMarkers.unshift(event);
  ctx.eventMarkers = ctx.eventMarkers.slice(0, MAX_EVENT_MARKERS);
  ctx.metrics.eventCount += 1;
}

// ---------------------------------------------------------------------------
// State Transitions
// ---------------------------------------------------------------------------

function startReverse(ctx: StepContext, reason: string, dir: number = 0): void {
  if (ctx.worm.state === 'reverse') return;
  ctx.worm.state = 'reverse';
  ctx.worm.stateTimer = ctx.config.worm.reversalDuration;
  ctx.worm.turnDir = (dir || (ctx.rand() > 0.5 ? 1 : -1)) as 1 | -1;
  ctx.metrics.reversals += 1;
  pushEvent(ctx, 'reverse', reason || 'Reverse');
}

function startTurn(ctx: StepContext, reason: string, dir: number = 0): void {
  if (ctx.worm.state === 'turn') return;
  ctx.worm.state = 'turn';
  ctx.worm.stateTimer = 260 + ctx.rand() * 360;
  ctx.worm.turnDir = (dir || (ctx.rand() > 0.5 ? 1 : -1)) as 1 | -1;
  ctx.metrics.turns += 1;
  pushEvent(ctx, 'turn', reason || 'Turn');
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function move(
  ctx: StepContext,
  direction: number,
  speed: number,
  dt: number,
): CollisionResult {
  const worm = ctx.worm;
  const next: Point = {
    x: worm.x + Math.cos(worm.heading) * speed * dt * direction,
    y: worm.y + Math.sin(worm.heading) * speed * dt * direction,
  };
  const collision = detectCollision(next, ctx.world);
  if (!collision.hit) {
    const travelled = Math.hypot(next.x - worm.x, next.y - worm.y);
    worm.x = next.x;
    worm.y = next.y;
    ctx.metrics.distance += travelled;
  }
  return collision;
}

// ---------------------------------------------------------------------------
// Body Update (verlet-like chain)
// ---------------------------------------------------------------------------

export function updateBody(worm: WormState, config: SimConfig): void {
  worm.segments[0] = { x: worm.x, y: worm.y };
  const targetDist = clamp(1.15 + (24 - config.worm.segmentCount) * 0.02, 0.9, 1.3);
  for (let i = 1; i < worm.segments.length; i += 1) {
    const prev = worm.segments[i - 1];
    const curr = worm.segments[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
    curr.x = prev.x + (dx / distance) * targetDist;
    curr.y = prev.y + (dy / distance) * targetDist;
  }
}

// ---------------------------------------------------------------------------
// Main Step
// ---------------------------------------------------------------------------

/**
 * Advance the simulation by one fixed time-step `dt` (in seconds).
 *
 * This function encapsulates the complete per-frame logic from the original
 * app.js WormSimulation.step(), including:
 * - Sensor sampling (touch, chemo, thermo)
 * - Metric accumulation
 * - Food zone enter/exit events
 * - Bias calculation (touch + chemo + thermo + exploration noise)
 * - State machine transitions (cruise -> reverse/turn, reverse -> turn, turn -> cruise)
 * - Movement and collision response
 * - Temporal chemo integration and heading normalization
 * - Body chain and trail updates
 *
 * All logic is preserved exactly from the original app.js.
 */
export function stepBehavior(ctx: StepContext, dt: number): StepResult {
  const { config, world, worm, rand } = ctx;
  const cfg = config;

  ctx.metrics.elapsed += dt;

  // --- Sensor sampling ---
  const samplePoints = computeSamplePoints(worm, cfg);
  const { frontPoint, leftPoint, rightPoint } = samplePoints;

  const touchFront = cfg.sensors.touch ? detectCollision(frontPoint, world).hit : false;
  const touchLeft = cfg.sensors.touch ? detectCollision(leftPoint, world).hit : false;
  const touchRight = cfg.sensors.touch ? detectCollision(rightPoint, world).hit : false;
  const noise = () => (rand() - 0.5) * cfg.sensors.noise * 0.1;
  const chemoLeft = cfg.sensors.chemo ? sampleFood(leftPoint, world) + noise() : 0;
  const chemoRight = cfg.sensors.chemo ? sampleFood(rightPoint, world) + noise() : 0;
  const chemoCenter = cfg.sensors.chemo
    ? sampleFood({ x: worm.x, y: worm.y }, world) + noise()
    : 0;
  const tempCurrent = sampleTemperature({ x: worm.x, y: worm.y }, cfg, world);
  const tempLeft = sampleTemperature(leftPoint, cfg, world);
  const tempRight = sampleTemperature(rightPoint, cfg, world);
  const tempError = Math.abs(cfg.world.preferredTemperature - tempCurrent);
  const insideFood =
    Math.hypot(worm.x - world.food.x, worm.y - world.food.y) <=
    world.food.radius * 0.95;

  // --- Update sensor state ---
  ctx.sensor = {
    chemoLeft,
    chemoRight,
    chemoCenter,
    tempCurrent,
    tempError,
    touchFront,
    touchLeft,
    touchRight,
    bias: ctx.sensor.bias || 0,
  };

  // --- Metrics ---
  ctx.metrics.samples += 1;
  ctx.metrics.chemoAccum += chemoCenter;
  ctx.metrics.tempErrorAccum += tempError;

  if (insideFood) {
    ctx.metrics.foodTime += dt;
    if (ctx.metrics.firstFoodTime == null) ctx.metrics.firstFoodTime = ctx.metrics.elapsed;
    if (!ctx.wasInsideFood) pushEvent(ctx, 'food', 'Food patch entered');
  } else if (ctx.wasInsideFood) {
    pushEvent(ctx, 'food-exit', 'Exited food patch');
  }
  const wasInsideFood = insideFood;

  // --- Bias computation ---
  const chemoBias = cfg.sensors.chemo ? chemoRight - chemoLeft : 0;
  const temporalChemo = cfg.sensors.chemo ? chemoCenter - ctx.prevChemo : 0;
  const thermoBias =
    cfg.sensors.thermo && cfg.world.temperatureMode !== 'none'
      ? Math.abs(cfg.world.preferredTemperature - tempLeft) -
        Math.abs(cfg.world.preferredTemperature - tempRight)
      : 0;
  const discomfort =
    cfg.sensors.thermo && cfg.world.temperatureMode !== 'none'
      ? Math.max(0, tempError - cfg.behavior.discomfort)
      : 0;
  const touchBias = touchLeft && !touchRight ? 1 : touchRight && !touchLeft ? -1 : 0;
  const randomBias = (rand() - 0.5) * cfg.behavior.exploration * 0.36;
  const combinedBias =
    touchBias * 1.8 +
    chemoBias * cfg.behavior.gradientGain * 1.35 +
    thermoBias * cfg.behavior.gradientGain * 1.15 +
    randomBias;
  ctx.sensor.bias = combinedBias;

  // --- State machine ---
  if (worm.state === 'cruise') {
    if (touchFront) {
      ctx.metrics.collisions += 1;
      pushEvent(ctx, 'collision', 'Contact \u2192 reverse');
      startReverse(
        ctx,
        'Collision reversal',
        touchLeft && !touchRight ? 1 : touchRight && !touchLeft ? -1 : 0,
      );
    } else {
      worm.heading += combinedBias * cfg.worm.turnSharpness * dt * 1.2;
      const turnTrigger =
        rand() <
        (cfg.behavior.turnProbability * 0.8 +
          Math.max(0, -temporalChemo) * 0.22 +
          discomfort * 0.18) *
          dt *
          3;
      if (turnTrigger && Math.abs(combinedBias) > 0.05) {
        startTurn(ctx, 'Gradient reorient', combinedBias >= 0 ? 1 : -1);
      } else {
        const speed =
          cfg.worm.baseSpeed *
          (insideFood ? 0.82 : 1) *
          (1 - clamp(tempError * 0.16, 0, 0.18));
        worm.lastSpeed = speed;
        const collision = move(ctx, 1, speed, dt);
        if (collision.hit) {
          ctx.metrics.collisions += 1;
          pushEvent(ctx, 'collision', 'Forward path blocked');
          startReverse(ctx, 'Blocked path', rand() > 0.5 ? 1 : -1);
        }
      }
    }
  } else if (worm.state === 'reverse') {
    worm.stateTimer -= dt * 1000;
    worm.lastSpeed = cfg.worm.baseSpeed * 0.56;
    const collision = move(ctx, -1, worm.lastSpeed, dt);
    if (collision.hit) worm.stateTimer = 0;
    worm.heading += worm.turnDir * cfg.worm.turnSharpness * dt * 0.4;
    if (worm.stateTimer <= 0) {
      startTurn(ctx, 'Reverse complete', worm.turnDir || (rand() > 0.5 ? 1 : -1));
    }
  } else if (worm.state === 'turn') {
    worm.stateTimer -= dt * 1000;
    worm.lastSpeed = cfg.worm.baseSpeed * 0.42;
    worm.heading += worm.turnDir * cfg.worm.turnSharpness * dt * 3.4;
    move(ctx, 1, worm.lastSpeed, dt * 0.42);
    if (worm.stateTimer <= 0) {
      worm.state = 'cruise';
      pushEvent(ctx, 'resume', 'Cruise resumed');
    }
  }

  // --- Temporal chemo integration ---
  const historyBlend = clamp((dt * 1000) / cfg.sensors.memory, 0.01, 0.4);
  const prevChemo = lerp(ctx.prevChemo, chemoCenter, historyBlend);

  // --- Heading normalization ---
  worm.heading = (worm.heading + Math.PI * 1000) % (Math.PI * 2);

  // --- Body chain ---
  updateBody(worm, cfg);

  // --- Trail ---
  worm.trail.push({ x: worm.x, y: worm.y });
  if (worm.trail.length > cfg.visuals.trailLength) {
    worm.trail.splice(0, worm.trail.length - cfg.visuals.trailLength);
  }

  return { prevChemo, wasInsideFood, samplePoints };
}
