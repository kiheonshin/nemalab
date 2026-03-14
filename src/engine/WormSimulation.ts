// ============================================================================
// Nema Lab Simulation Engine — Core WormSimulation Class
// Pure TypeScript, zero browser/DOM/Canvas dependencies
//
// Faithfully preserves the original app.js WormSimulation logic:
// state machine, sensors, RNG, metrics, events.
// Canvas rendering is moved to src/renderer/.
// ============================================================================

import type {
  SimConfig,
  World,
  WormState,
  SensorState,
  SamplePoints,
  CollisionResult,
  RawMetrics,
  Metrics,
  Snapshot,
  SimEvent,
  SimEventType,
  Point,
  Explanation,
} from './types';
import { mulberry32, hashString, randomSeed } from './rng';
import { clamp, lerp, deepClone } from './math';
import { generateWorld } from './WorldGenerator';
import {
  SENSOR_ANGLE_OFFSET,
  FRONT_SENSOR_EXTRA,
  SEGMENT_BASE_DISTANCE,
  WALL_MARGIN,
  WORLD_SIZE,
  OBSTACLE_COLLISION_PAD,
  MAX_RECENT_EVENTS,
  MAX_EVENT_MARKERS,
} from './constants';
import {
  generateExplanations,
  generatePrimaryExplanation,
  type ExplanationContext,
} from './ExplanationEngine';

export class WormSimulation {
  config: SimConfig;
  seed: string;
  world: World;
  worm: WormState;
  sensor: SensorState;
  metrics: RawMetrics;
  recentEvents: SimEvent[];
  eventMarkers: SimEvent[];
  lastSamplePoints: SamplePoints;
  prevChemo: number;
  wasInsideFood: boolean;

  private rand: () => number;
  private _running: boolean = true;

  constructor(config: SimConfig, seed?: string) {
    this.config = deepClone(config);
    this.seed = seed || randomSeed();
    this.rand = () => 0; // placeholder, reset() initializes properly
    this.world = generateWorld(this.config, this.seed);
    this.worm = this._initWormState();
    this.sensor = this._initSensorState();
    this.metrics = this._initMetrics();
    this.recentEvents = [];
    this.eventMarkers = [];
    this.prevChemo = 0;
    this.wasInsideFood = false;
    this.lastSamplePoints = this.computeSamplePoints();
    this.reset(true);
  }

  // ===== Public API =====

  setConfig(config: SimConfig, regenerateWorld = true): void {
    this.config = deepClone(config);
    if (regenerateWorld) {
      this.world = generateWorld(this.config, this.seed);
      this.reset(true);
    }
  }

  setSeed(seed: string): void {
    this.seed = seed;
    this.world = generateWorld(this.config, this.seed);
    this.reset(true);
  }

  reset(regenerateWorld = false): void {
    if (regenerateWorld) {
      this.world = generateWorld(this.config, this.seed);
    }

    const cfg = this.config;
    const seedGen = hashString(
      `${this.seed}|run|${cfg.worm.baseSpeed}|${cfg.behavior.turnProbability}|${cfg.behavior.exploration}`,
    )();
    this.rand = mulberry32(seedGen);

    this.metrics = this._initMetrics();
    this.recentEvents = [];
    this.eventMarkers = [];
    this.wasInsideFood = false;
    this.prevChemo = this.sampleFood({ x: 18, y: 72 });
    this.sensor = this._initSensorState();

    this.worm = {
      x: 18 + this.rand() * 7,
      y: 72 - this.rand() * 14,
      heading: -0.22 + this.rand() * 0.28,
      state: 'cruise',
      stateTimer: 0,
      turnDir: this.rand() > 0.5 ? 1 : -1,
      lastSpeed: cfg.worm.baseSpeed,
      segments: [],
      trail: [],
    };

    for (let i = 0; i < cfg.worm.segmentCount; i += 1) {
      this.worm.segments.push({
        x: this.worm.x - i * SEGMENT_BASE_DISTANCE * Math.cos(this.worm.heading),
        y: this.worm.y - i * SEGMENT_BASE_DISTANCE * Math.sin(this.worm.heading),
      });
    }

    this.lastSamplePoints = this.computeSamplePoints();
    this.worm.trail = [{ x: this.worm.x, y: this.worm.y }];
    this.pushEvent('start', 'Run initialized');
  }

  step(dt: number): void {
    const cfg = this.config;
    const worm = this.worm;
    this.metrics.elapsed += dt;

    const { frontPoint, leftPoint, rightPoint } = this.computeSamplePoints();
    this.lastSamplePoints = { frontPoint, leftPoint, rightPoint };

    // --- Sensor sampling ---
    const touchFront = cfg.sensors.touch ? this.detectCollision(frontPoint).hit : false;
    const touchLeft = cfg.sensors.touch ? this.detectCollision(leftPoint).hit : false;
    const touchRight = cfg.sensors.touch ? this.detectCollision(rightPoint).hit : false;
    const noise = () => (this.rand() - 0.5) * cfg.sensors.noise * 0.1;
    const chemoLeft = cfg.sensors.chemo ? this.sampleFood(leftPoint) + noise() : 0;
    const chemoRight = cfg.sensors.chemo ? this.sampleFood(rightPoint) + noise() : 0;
    const chemoCenter = cfg.sensors.chemo ? this.sampleFood({ x: worm.x, y: worm.y }) + noise() : 0;
    const tempCurrent = this.sampleTemperature({ x: worm.x, y: worm.y });
    const tempLeft = this.sampleTemperature(leftPoint);
    const tempRight = this.sampleTemperature(rightPoint);
    const tempError = Math.abs(cfg.world.preferredTemperature - tempCurrent);
    const insideFood =
      Math.hypot(worm.x - this.world.food.x, worm.y - this.world.food.y) <=
      this.world.food.radius * 0.95;

    this.sensor = {
      chemoLeft,
      chemoRight,
      chemoCenter,
      tempCurrent,
      tempError,
      touchFront,
      touchLeft,
      touchRight,
      bias: this.sensor.bias || 0,
    };

    // --- Metrics accumulation ---
    this.metrics.samples += 1;
    this.metrics.chemoAccum += chemoCenter;
    this.metrics.tempErrorAccum += tempError;
    if (insideFood) {
      this.metrics.foodTime += dt;
      if (this.metrics.firstFoodTime == null) {
        this.metrics.firstFoodTime = this.metrics.elapsed;
      }
      if (!this.wasInsideFood) this.pushEvent('food', 'Food patch entered');
    } else if (this.wasInsideFood) {
      this.pushEvent('food-exit', 'Exited food patch');
    }
    this.wasInsideFood = insideFood;

    // --- Bias computation ---
    const chemoBias = cfg.sensors.chemo ? chemoRight - chemoLeft : 0;
    const temporalChemo = cfg.sensors.chemo ? chemoCenter - this.prevChemo : 0;
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
    const randomBias = (this.rand() - 0.5) * cfg.behavior.exploration * 0.36;
    const combinedBias =
      touchBias * 1.8 +
      chemoBias * cfg.behavior.gradientGain * 1.35 +
      thermoBias * cfg.behavior.gradientGain * 1.15 +
      randomBias;
    this.sensor.bias = combinedBias;

    // --- State machine ---
    if (worm.state === 'cruise') {
      if (touchFront) {
        this.metrics.collisions += 1;
        this.pushEvent('collision', 'Contact \u2192 reverse');
        this.startReverse(
          'Collision reversal',
          touchLeft && !touchRight ? 1 : touchRight && !touchLeft ? -1 : 0,
        );
      } else {
        worm.heading += combinedBias * cfg.worm.turnSharpness * dt * 1.2;
        const turnTrigger =
          this.rand() <
          (cfg.behavior.turnProbability * 0.8 +
            Math.max(0, -temporalChemo) * 0.22 +
            discomfort * 0.18) *
            dt *
            3;
        if (turnTrigger && Math.abs(combinedBias) > 0.05) {
          this.startTurn('Gradient reorient', combinedBias >= 0 ? 1 : -1);
        } else {
          const speed =
            cfg.worm.baseSpeed *
            (insideFood ? 0.82 : 1) *
            (1 - clamp(tempError * 0.16, 0, 0.18));
          worm.lastSpeed = speed;
          const collision = this.move(1, speed, dt);
          if (collision.hit) {
            this.metrics.collisions += 1;
            this.pushEvent('collision', 'Forward path blocked');
            this.startReverse('Blocked path', this.rand() > 0.5 ? 1 : -1);
          }
        }
      }
    } else if (worm.state === 'reverse') {
      worm.stateTimer -= dt * 1000;
      worm.lastSpeed = cfg.worm.baseSpeed * 0.56;
      const collision = this.move(-1, worm.lastSpeed, dt);
      if (collision.hit) worm.stateTimer = 0;
      worm.heading += worm.turnDir * cfg.worm.turnSharpness * dt * 0.4;
      if (worm.stateTimer <= 0) {
        this.startTurn(
          'Reverse complete',
          worm.turnDir || (this.rand() > 0.5 ? 1 : -1),
        );
      }
    } else if (worm.state === 'turn') {
      worm.stateTimer -= dt * 1000;
      worm.lastSpeed = cfg.worm.baseSpeed * 0.42;
      worm.heading += worm.turnDir * cfg.worm.turnSharpness * dt * 3.4;
      this.move(1, worm.lastSpeed, dt * 0.42);
      if (worm.stateTimer <= 0) {
        worm.state = 'cruise';
        this.pushEvent('resume', 'Cruise resumed');
      }
    }

    // --- Temporal memory blend ---
    const historyBlend = clamp((dt * 1000) / cfg.sensors.memory, 0.01, 0.4);
    this.prevChemo = lerp(this.prevChemo, chemoCenter, historyBlend);

    // --- Normalize heading ---
    worm.heading = (worm.heading + Math.PI * 1000) % (Math.PI * 2);

    // --- Update body & trail ---
    this.updateBody();
    worm.trail.push({ x: worm.x, y: worm.y });
    if (worm.trail.length > cfg.visuals.trailLength) {
      worm.trail.splice(0, worm.trail.length - cfg.visuals.trailLength);
    }
  }

  getMetrics(): Metrics {
    const samples = Math.max(1, this.metrics.samples);
    return {
      elapsed: this.metrics.elapsed,
      distance: this.metrics.distance,
      collisions: this.metrics.collisions,
      turns: this.metrics.turns,
      reversals: this.metrics.reversals,
      foodTime: this.metrics.foodTime,
      firstFoodTime: this.metrics.firstFoodTime,
      avgChemo: this.metrics.chemoAccum / samples,
      avgTempError: this.metrics.tempErrorAccum / samples,
      eventCount: this.metrics.eventCount,
    };
  }

  getSnapshot(): Snapshot {
    return {
      state: this.worm.state,
      position: { x: this.worm.x, y: this.worm.y },
      heading: this.worm.heading,
      speed: this.worm.lastSpeed,
      sensor: { ...this.sensor },
      metrics: this.getMetrics(),
      events: [...this.recentEvents],
    };
  }

  getState(): {
    worm: WormState;
    sensor: SensorState;
    world: World;
    metrics: RawMetrics;
    recentEvents: SimEvent[];
    eventMarkers: SimEvent[];
  } {
    return {
      worm: this.worm,
      sensor: this.sensor,
      world: this.world,
      metrics: this.metrics,
      recentEvents: this.recentEvents,
      eventMarkers: this.eventMarkers,
    };
  }

  getRecentEvents(): SimEvent[] {
    return [...this.recentEvents];
  }

  getSamplePoints(): SamplePoints {
    return this.lastSamplePoints;
  }

  getWorld(): World {
    return this.world;
  }

  getConfig(): SimConfig {
    return this.config;
  }

  getSeed(): string {
    return this.seed;
  }

  getWorm(): WormState {
    return this.worm;
  }

  // ===== Running state (UI play/pause control) =====

  isRunning(): boolean {
    return this._running;
  }

  setRunning(value: boolean): void {
    this._running = value;
  }

  // ===== Explanation integration =====

  /** Generate all explanation lines for the current state. */
  getExplanations(): Explanation[] {
    return generateExplanations(this._buildExplanationContext());
  }

  /** Generate single primary explanation for compact display. */
  getPrimaryExplanation(): Explanation {
    return generatePrimaryExplanation(this._buildExplanationContext());
  }

  // ===== Serialization (for IndexedDB saved runs) =====

  /**
   * Export full state for persistence.
   * Everything needed to display a saved run snapshot.
   */
  serialize(): {
    config: SimConfig;
    seed: string;
    snapshot: Snapshot;
    world: World;
    worm: WormState;
    sensor: SensorState;
    metrics: RawMetrics;
    recentEvents: SimEvent[];
  } {
    return {
      config: deepClone(this.config),
      seed: this.seed,
      snapshot: this.getSnapshot(),
      world: deepClone(this.world),
      worm: deepClone(this.worm),
      sensor: { ...this.sensor },
      metrics: { ...this.metrics },
      recentEvents: [...this.recentEvents],
    };
  }

  // ===== Internal Methods =====

  computeSamplePoints(): SamplePoints {
    const sd = this.config.sensors.sampleDistance;
    const { x, y, heading } = this.worm;
    const leftAngle = heading - SENSOR_ANGLE_OFFSET;
    const rightAngle = heading + SENSOR_ANGLE_OFFSET;
    return {
      frontPoint: {
        x: x + Math.cos(heading) * (sd + FRONT_SENSOR_EXTRA),
        y: y + Math.sin(heading) * (sd + FRONT_SENSOR_EXTRA),
      },
      leftPoint: {
        x: x + Math.cos(leftAngle) * sd,
        y: y + Math.sin(leftAngle) * sd,
      },
      rightPoint: {
        x: x + Math.cos(rightAngle) * sd,
        y: y + Math.sin(rightAngle) * sd,
      },
    };
  }

  sampleFood(point: Point): number {
    const { food } = this.world;
    const dx = point.x - food.x;
    const dy = point.y - food.y;
    const sigma = food.radius * 1.55;
    return food.strength * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }

  sampleTemperature(point: Point): number {
    const { temperatureMode, preferredTemperature } = this.config.world;
    if (temperatureMode === 'none') return preferredTemperature;
    if (temperatureMode === 'linear') return clamp(point.x / WORLD_SIZE, 0, 1);
    const hotspot = this.world.temperatureHotspot;
    const d = Math.hypot(point.x - hotspot.x, point.y - hotspot.y);
    return clamp(1 - d / 62, 0, 1);
  }

  detectCollision(point: Point): CollisionResult {
    if (
      point.x < WALL_MARGIN ||
      point.x > WORLD_SIZE - WALL_MARGIN ||
      point.y < WALL_MARGIN ||
      point.y > WORLD_SIZE - WALL_MARGIN
    ) {
      return { hit: true, kind: 'wall' };
    }
    for (const obstacle of this.world.obstacles) {
      if (
        Math.hypot(point.x - obstacle.x, point.y - obstacle.y) <
        obstacle.r + OBSTACLE_COLLISION_PAD
      ) {
        return { hit: true, kind: 'obstacle' };
      }
    }
    return { hit: false, kind: 'none' };
  }

  private startReverse(reason: string, dir: number): void {
    if (this.worm.state === 'reverse') return;
    this.worm.state = 'reverse';
    this.worm.stateTimer = this.config.worm.reversalDuration;
    this.worm.turnDir = (dir || (this.rand() > 0.5 ? 1 : -1)) as 1 | -1;
    this.metrics.reversals += 1;
    this.pushEvent('reverse', reason || 'Reverse');
  }

  private startTurn(reason: string, dir: number): void {
    if (this.worm.state === 'turn') return;
    this.worm.state = 'turn';
    this.worm.stateTimer = 260 + this.rand() * 360;
    this.worm.turnDir = (dir || (this.rand() > 0.5 ? 1 : -1)) as 1 | -1;
    this.metrics.turns += 1;
    this.pushEvent('turn', reason || 'Turn');
  }

  private move(direction: number, speed: number, dt: number): CollisionResult {
    const next: Point = {
      x: this.worm.x + Math.cos(this.worm.heading) * speed * dt * direction,
      y: this.worm.y + Math.sin(this.worm.heading) * speed * dt * direction,
    };
    const collision = this.detectCollision(next);
    if (!collision.hit) {
      const travelled = Math.hypot(next.x - this.worm.x, next.y - this.worm.y);
      this.worm.x = next.x;
      this.worm.y = next.y;
      this.metrics.distance += travelled;
    }
    return collision;
  }

  private updateBody(): void {
    const worm = this.worm;
    const cfg = this.config;
    worm.segments[0] = { x: worm.x, y: worm.y };
    const targetDist = clamp(1.15 + (24 - cfg.worm.segmentCount) * 0.02, 0.9, 1.3);
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

  private pushEvent(type: SimEventType, title: string): void {
    const event: SimEvent = {
      type,
      title,
      time: this.metrics.elapsed,
      x: this.worm ? this.worm.x : 0,
      y: this.worm ? this.worm.y : 0,
    };
    this.recentEvents.unshift(event);
    this.recentEvents = this.recentEvents.slice(0, MAX_RECENT_EVENTS);
    this.eventMarkers.unshift(event);
    this.eventMarkers = this.eventMarkers.slice(0, MAX_EVENT_MARKERS);
    this.metrics.eventCount += 1;
  }

  private _initWormState(): WormState {
    return {
      x: 18,
      y: 72,
      heading: 0,
      state: 'cruise',
      stateTimer: 0,
      turnDir: 1,
      lastSpeed: this.config.worm.baseSpeed,
      segments: [],
      trail: [],
    };
  }

  private _initSensorState(): SensorState {
    return {
      chemoLeft: 0,
      chemoRight: 0,
      chemoCenter: 0,
      tempCurrent: 0.5,
      tempError: 0,
      touchFront: false,
      touchLeft: false,
      touchRight: false,
      bias: 0,
    };
  }

  private _initMetrics(): RawMetrics {
    return {
      elapsed: 0,
      distance: 0,
      collisions: 0,
      turns: 0,
      reversals: 0,
      foodTime: 0,
      firstFoodTime: null,
      chemoAccum: 0,
      tempErrorAccum: 0,
      samples: 0,
      eventCount: 0,
    };
  }

  private _buildExplanationContext(): ExplanationContext {
    return {
      config: this.config,
      worm: this.worm,
      sensor: this.sensor,
      world: this.world,
      metrics: this.metrics,
      recentEvents: this.recentEvents,
      wasInsideFood: this.wasInsideFood,
    };
  }
}
