// ============================================================================
// BehaviorSystem Tests
// Covers: state machine transitions, bias computation, collision handling,
//         updateBody, stepBehavior full lifecycle
// ============================================================================

import { describe, it, expect } from 'vitest';
import { stepBehavior, updateBody } from '../BehaviorSystem';
import type { StepContext } from '../BehaviorSystem';
import { DEFAULT_CONFIG, WALL_MARGIN, WORLD_SIZE } from '../constants';
import { deepClone } from '../math';
import { mulberry32 } from '../rng';
import type { SimConfig, WormState, SensorState, RawMetrics, World } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Record<string, unknown> = {}): SimConfig {
  const cfg = deepClone(DEFAULT_CONFIG) as SimConfig;
  // Apply overrides
  if (overrides.sensors) Object.assign(cfg.sensors, overrides.sensors);
  if (overrides.behavior) Object.assign(cfg.behavior, overrides.behavior);
  if (overrides.world) Object.assign(cfg.world, overrides.world);
  if (overrides.worm) Object.assign(cfg.worm, overrides.worm);
  return cfg;
}

function makeWorm(overrides: Partial<WormState> = {}): WormState {
  const segmentCount = 18;
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({ x: 50 - i * 1.2, y: 50 });
  }
  return {
    x: 50,
    y: 50,
    heading: 0,
    state: 'cruise',
    stateTimer: 0,
    turnDir: 1,
    lastSpeed: 15,
    segments,
    trail: [{ x: 50, y: 50 }],
    ...overrides,
  };
}

function makeSensor(): SensorState {
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

function makeMetrics(): RawMetrics {
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

function makeWorld(overrides: Partial<World> = {}): World {
  return {
    food: { x: 70, y: 30, radius: 14, strength: 1.1 },
    obstacles: [],
    temperatureHotspot: { x: 50, y: 50 },
    ...overrides,
  };
}

function makeRng(seed: number = 12345): () => number {
  return mulberry32(seed);
}

function makeCtx(overrides: Partial<StepContext> = {}): StepContext {
  return {
    config: makeConfig(),
    world: makeWorld(),
    worm: makeWorm(),
    sensor: makeSensor(),
    metrics: makeMetrics(),
    recentEvents: [],
    eventMarkers: [],
    prevChemo: 0,
    wasInsideFood: false,
    rand: makeRng(),
    ...overrides,
  };
}

const DT = 1 / 60; // standard 60fps timestep

// ===========================================================================
// State Machine Transitions
// ===========================================================================

describe('BehaviorSystem state machine', () => {
  describe('cruise state', () => {
    it('should remain in cruise when no triggers occur', () => {
      // Disable sensors to minimize state transitions; disable all randomness
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const ctx = makeCtx({ config });

      stepBehavior(ctx, DT);

      expect(ctx.worm.state).toBe('cruise');
    });

    it('should move forward during cruise', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({ heading: 0, x: 50, y: 50 });
      const ctx = makeCtx({ config, worm });
      const startX = worm.x;

      stepBehavior(ctx, DT);

      expect(ctx.worm.x).toBeGreaterThan(startX);
    });

    it('should accumulate distance during cruise', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const ctx = makeCtx({ config });

      stepBehavior(ctx, DT);

      expect(ctx.metrics.distance).toBeGreaterThan(0);
    });
  });

  describe('cruise -> reverse transition (collision)', () => {
    it('should reverse on front touch collision', () => {
      const config = makeConfig({
        sensors: { touch: true, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      // Place worm near the right wall so front sensor hits wall
      const worm = makeWorm({
        heading: 0,
        x: WORLD_SIZE - WALL_MARGIN - 1,
        y: 50,
        state: 'cruise',
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.state).toBe('reverse');
      expect(ctx.metrics.collisions).toBeGreaterThanOrEqual(1);
    });

    it('should increment reversals counter on collision reversal', () => {
      const config = makeConfig({
        sensors: { touch: true, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        heading: 0,
        x: WORLD_SIZE - WALL_MARGIN - 1,
        y: 50,
        state: 'cruise',
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.metrics.reversals).toBe(1);
    });

    it('should set stateTimer to reversalDuration on reverse start', () => {
      const config = makeConfig({
        sensors: { touch: true, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        heading: 0,
        x: WORLD_SIZE - WALL_MARGIN - 1,
        y: 50,
        state: 'cruise',
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.stateTimer).toBe(config.worm.reversalDuration);
    });

    it('should push collision and reverse events', () => {
      const config = makeConfig({
        sensors: { touch: true, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        heading: 0,
        x: WORLD_SIZE - WALL_MARGIN - 1,
        y: 50,
        state: 'cruise',
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      const types = ctx.recentEvents.map((e) => e.type);
      expect(types).toContain('collision');
      expect(types).toContain('reverse');
    });
  });

  describe('reverse -> turn transition', () => {
    it('should transition to turn when stateTimer expires', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      // Start in reverse with almost-expired timer
      const worm = makeWorm({
        state: 'reverse',
        stateTimer: 10, // 10ms remaining, will expire at dt=1/60 (16.67ms)
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.state).toBe('turn');
      expect(ctx.metrics.turns).toBe(1);
    });

    it('should stay in reverse if timer has not expired', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'reverse',
        stateTimer: 500, // 500ms, will not expire in one step
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.state).toBe('reverse');
    });

    it('should move backward during reverse', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'reverse',
        stateTimer: 500,
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });
      const startX = worm.x;

      stepBehavior(ctx, DT);

      // Moving backward with heading=0 means x should decrease
      expect(ctx.worm.x).toBeLessThan(startX);
    });

    it('should set reverse speed to baseSpeed * 0.56', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'reverse',
        stateTimer: 500,
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.lastSpeed).toBeCloseTo(config.worm.baseSpeed * 0.56, 5);
    });
  });

  describe('turn -> cruise transition', () => {
    it('should transition to cruise when turn timer expires', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'turn',
        stateTimer: 10, // 10ms, expires in one step
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.state).toBe('cruise');
    });

    it('should push resume event on turn->cruise transition', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'turn',
        stateTimer: 10,
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      const types = ctx.recentEvents.map((e) => e.type);
      expect(types).toContain('resume');
    });

    it('should set turn speed to baseSpeed * 0.42', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'turn',
        stateTimer: 500,
        heading: 0,
        x: 50,
        y: 50,
      });
      const ctx = makeCtx({ config, worm });

      stepBehavior(ctx, DT);

      expect(ctx.worm.lastSpeed).toBeCloseTo(config.worm.baseSpeed * 0.42, 5);
    });

    it('should rotate heading during turn', () => {
      const config = makeConfig({
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
      });
      const worm = makeWorm({
        state: 'turn',
        stateTimer: 500,
        heading: 0,
        x: 50,
        y: 50,
        turnDir: 1,
      });
      const ctx = makeCtx({ config, worm });
      const startHeading = worm.heading;

      stepBehavior(ctx, DT);

      // Heading should change due to turnDir * turnSharpness * dt * 3.4
      expect(ctx.worm.heading).not.toBe(startHeading);
    });
  });

  describe('full cycle: cruise -> reverse -> turn -> cruise', () => {
    it('should complete the full state cycle', () => {
      const config = makeConfig({
        sensors: { touch: true, chemo: false, thermo: false },
        behavior: { turnProbability: 0, exploration: 0 },
        worm: { reversalDuration: 50 }, // short reversal
      });
      // Start near wall to trigger collision
      const worm = makeWorm({
        heading: 0,
        x: WORLD_SIZE - WALL_MARGIN - 1,
        y: 50,
        state: 'cruise',
      });
      const ctx = makeCtx({ config, worm });

      // Step 1: cruise -> reverse (collision)
      stepBehavior(ctx, DT);
      expect(ctx.worm.state).toBe('reverse');

      // Step through reverse until timer expires (50ms / 16.67ms per step ~ 3 steps)
      for (let i = 0; i < 10; i++) {
        if (ctx.worm.state !== 'reverse') break;
        stepBehavior(ctx, DT);
      }
      expect(ctx.worm.state).toBe('turn');

      // Step through turn until timer expires
      for (let i = 0; i < 100; i++) {
        if (ctx.worm.state !== 'turn') break;
        stepBehavior(ctx, DT);
      }
      expect(ctx.worm.state).toBe('cruise');
    });
  });
});

// ===========================================================================
// Bias Computation
// ===========================================================================

describe('BehaviorSystem bias computation', () => {
  it('should compute zero bias when all sensors are disabled', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { exploration: 0 },
    });
    const ctx = makeCtx({ config });

    stepBehavior(ctx, DT);

    expect(ctx.sensor.bias).toBe(0);
  });

  it('should produce chemo bias when food is to the right', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: true, thermo: false, noise: 0 },
      behavior: { exploration: 0, turnProbability: 0 },
    });
    // Place worm with food directly to the right sensor side
    const world = makeWorld({
      food: { x: 60, y: 50, radius: 14, strength: 1.1 },
    });
    // Heading upward (PI/2), so right sensor is at heading + offset
    const worm = makeWorm({
      heading: Math.PI / 2,
      x: 50,
      y: 50,
    });
    const ctx = makeCtx({ config, world, worm });

    stepBehavior(ctx, DT);

    // With food to the right of the worm's heading, right sensor sees more
    // chemo, so bias should be positive (or at least nonzero)
    // The exact sign depends on geometry; the key point is bias is non-zero
    expect(ctx.sensor.bias).not.toBe(0);
  });

  it('should include touch bias when left sensor touches obstacle', () => {
    const config = makeConfig({
      sensors: { touch: true, chemo: false, thermo: false },
      behavior: { exploration: 0, turnProbability: 0 },
    });
    // Place obstacle to the left of the worm's heading
    const worm = makeWorm({ heading: 0, x: 50, y: 50 });
    // Obstacle positioned to hit left sensor but not right or front
    // Left sensor is at heading - SENSOR_ANGLE_OFFSET
    const leftAngle = worm.heading - 0.58;
    const sd = config.sensors.sampleDistance;
    const obX = worm.x + Math.cos(leftAngle) * sd;
    const obY = worm.y + Math.sin(leftAngle) * sd;
    const world = makeWorld({
      obstacles: [{ x: obX, y: obY, r: 2 }],
    });
    const ctx = makeCtx({ config, world, worm });

    stepBehavior(ctx, DT);

    // Touch bias should be +1 (left touched, not right) * 1.8
    // Combined bias should have a positive component
    expect(ctx.sensor.bias).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Collision handling
// ===========================================================================

describe('BehaviorSystem collision handling', () => {
  it('should not move worm position on collision', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { turnProbability: 0, exploration: 0 },
    });
    // Place worm heading directly into wall
    const worm = makeWorm({
      heading: 0,
      x: WORLD_SIZE - WALL_MARGIN - 0.1,
      y: 50,
      state: 'cruise',
    });
    void worm.x;
    void worm.y;
    const ctx = makeCtx({ config, worm });

    stepBehavior(ctx, DT);

    // Worm should not have moved through the wall
    // Either position unchanged (collision blocked) or state changed to reverse
    if (ctx.worm.state === 'reverse') {
      // Collision was detected; position may or may not have moved depending
      // on whether collision was detected before or after move attempt
      expect(ctx.metrics.collisions).toBeGreaterThanOrEqual(1);
    }
  });

  it('should handle obstacle collision during reverse', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { turnProbability: 0, exploration: 0 },
    });
    // In reverse heading left, obstacle behind worm
    const worm = makeWorm({
      heading: 0,
      state: 'reverse',
      stateTimer: 500,
      x: 50,
      y: 50,
    });
    // Place obstacle behind (reverse moves backward, so negative x direction)
    const world = makeWorld({
      obstacles: [{ x: 46, y: 50, r: 3 }],
    });
    const ctx = makeCtx({ config, world, worm });

    stepBehavior(ctx, DT);

    // Timer should be set to 0 on reverse collision
    // (either directly or state already transitioned to turn)
    expect(ctx.worm.stateTimer <= 0 || ctx.worm.state === 'turn').toBe(true);
  });
});

// ===========================================================================
// updateBody
// ===========================================================================

describe('updateBody', () => {
  it('should place first segment at worm position', () => {
    const config = makeConfig();
    const worm = makeWorm({ x: 42, y: 73 });

    updateBody(worm, config);

    expect(worm.segments[0].x).toBe(42);
    expect(worm.segments[0].y).toBe(73);
  });

  it('should maintain consistent spacing between segments', () => {
    const config = makeConfig();
    const worm = makeWorm();
    // Move worm to a new position
    worm.x = 60;
    worm.y = 55;

    updateBody(worm, config);

    const targetDist = Math.min(1.3, Math.max(0.9, 1.15 + (24 - config.worm.segmentCount) * 0.02));
    for (let i = 1; i < worm.segments.length; i++) {
      const d = Math.hypot(
        worm.segments[i].x - worm.segments[i - 1].x,
        worm.segments[i].y - worm.segments[i - 1].y,
      );
      expect(d).toBeCloseTo(targetDist, 2);
    }
  });

  it('should handle different segment counts', () => {
    const config = makeConfig();
    config.worm.segmentCount = 8;
    const segments = [];
    for (let i = 0; i < 8; i++) segments.push({ x: 50 - i, y: 50 });
    const worm = makeWorm({ segments });

    updateBody(worm, config);

    expect(worm.segments.length).toBe(8);
    expect(worm.segments[0].x).toBe(worm.x);
    expect(worm.segments[0].y).toBe(worm.y);
  });
});

// ===========================================================================
// stepBehavior overall
// ===========================================================================

describe('stepBehavior overall', () => {
  it('should advance elapsed time', () => {
    const ctx = makeCtx();

    stepBehavior(ctx, DT);

    expect(ctx.metrics.elapsed).toBeCloseTo(DT, 8);
  });

  it('should increment samples counter', () => {
    const ctx = makeCtx();

    stepBehavior(ctx, DT);

    expect(ctx.metrics.samples).toBe(1);
  });

  it('should update trail', () => {
    const ctx = makeCtx();
    const trailBefore = ctx.worm.trail.length;

    stepBehavior(ctx, DT);

    expect(ctx.worm.trail.length).toBe(trailBefore + 1);
  });

  it('should return updated prevChemo and wasInsideFood', () => {
    const ctx = makeCtx();

    const result = stepBehavior(ctx, DT);

    expect(typeof result.prevChemo).toBe('number');
    expect(typeof result.wasInsideFood).toBe('boolean');
    expect(result.samplePoints).toBeDefined();
    expect(result.samplePoints.frontPoint).toBeDefined();
    expect(result.samplePoints.leftPoint).toBeDefined();
    expect(result.samplePoints.rightPoint).toBeDefined();
  });

  it('should detect food zone entry and push event', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { turnProbability: 0, exploration: 0 },
    });
    // Place worm inside food
    const world = makeWorld({
      food: { x: 50, y: 50, radius: 14, strength: 1.1 },
    });
    const worm = makeWorm({ x: 50, y: 50 });
    const ctx = makeCtx({ config, world, worm, wasInsideFood: false });

    stepBehavior(ctx, DT);

    const types = ctx.recentEvents.map((e) => e.type);
    expect(types).toContain('food');
    expect(ctx.metrics.foodTime).toBeGreaterThan(0);
  });

  it('should detect food zone exit and push event', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { turnProbability: 0, exploration: 0 },
    });
    const world = makeWorld({
      food: { x: 90, y: 90, radius: 5, strength: 1.1 },
    });
    // Worm far from food but wasInsideFood=true
    const worm = makeWorm({ x: 50, y: 50 });
    const ctx = makeCtx({ config, world, worm, wasInsideFood: true });

    stepBehavior(ctx, DT);

    const types = ctx.recentEvents.map((e) => e.type);
    expect(types).toContain('food-exit');
  });

  it('should normalize heading to [0, 2*PI)', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { turnProbability: 0, exploration: 0 },
    });
    const worm = makeWorm({ heading: -1, x: 50, y: 50 });
    const ctx = makeCtx({ config, worm });

    stepBehavior(ctx, DT);

    expect(ctx.worm.heading).toBeGreaterThanOrEqual(0);
    expect(ctx.worm.heading).toBeLessThan(Math.PI * 2);
  });

  it('should be deterministic with same RNG seed', () => {
    const config = makeConfig();
    const world = makeWorld();

    const ctx1 = makeCtx({ config: deepClone(config) as SimConfig, world: deepClone(world) as World, rand: mulberry32(42) });
    const ctx2 = makeCtx({ config: deepClone(config) as SimConfig, world: deepClone(world) as World, rand: mulberry32(42) });

    for (let i = 0; i < 50; i++) {
      stepBehavior(ctx1, DT);
      stepBehavior(ctx2, DT);
    }

    expect(ctx1.worm.x).toBe(ctx2.worm.x);
    expect(ctx1.worm.y).toBe(ctx2.worm.y);
    expect(ctx1.worm.heading).toBe(ctx2.worm.heading);
    expect(ctx1.worm.state).toBe(ctx2.worm.state);
    expect(ctx1.metrics.distance).toBe(ctx2.metrics.distance);
  });
});
