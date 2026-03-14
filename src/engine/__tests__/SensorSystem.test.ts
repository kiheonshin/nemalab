// ============================================================================
// SensorSystem Tests
// Covers: computeSamplePoints, sampleFood, sampleTemperature, detectCollision
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  computeSamplePoints,
  sampleFood,
  sampleTemperature,
  detectCollision,
} from '../SensorSystem';
import { DEFAULT_CONFIG, SENSOR_ANGLE_OFFSET, FRONT_SENSOR_EXTRA, WALL_MARGIN, WORLD_SIZE } from '../constants';
import { deepClone } from '../math';
import type { SimConfig, WormState, World } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): SimConfig {
  return deepClone(DEFAULT_CONFIG) as SimConfig;
}

function makeWorm(overrides: Partial<WormState> = {}): WormState {
  return {
    x: 50,
    y: 50,
    heading: 0,
    state: 'cruise',
    stateTimer: 0,
    turnDir: 1,
    lastSpeed: 15,
    segments: [{ x: 50, y: 50 }],
    trail: [],
    ...overrides,
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

// ===========================================================================
// computeSamplePoints
// ===========================================================================

describe('computeSamplePoints', () => {
  it('should place front point ahead along heading (heading=0)', () => {
    const config = makeConfig();
    const worm = makeWorm({ heading: 0 });
    const sp = computeSamplePoints(worm, config);

    const expectedDist = config.sensors.sampleDistance + FRONT_SENSOR_EXTRA;
    expect(sp.frontPoint.x).toBeCloseTo(worm.x + expectedDist, 5);
    expect(sp.frontPoint.y).toBeCloseTo(worm.y, 5);
  });

  it('should place left/right points at symmetric angles', () => {
    const config = makeConfig();
    const worm = makeWorm({ heading: 0 });
    const sp = computeSamplePoints(worm, config);

    // Left and right should be symmetric about the heading axis
    expect(sp.leftPoint.y).toBeCloseTo(-sp.rightPoint.y + 2 * worm.y, 5);
    expect(sp.leftPoint.x).toBeCloseTo(sp.rightPoint.x, 5);
  });

  it('should place left point at heading - SENSOR_ANGLE_OFFSET', () => {
    const config = makeConfig();
    const worm = makeWorm({ heading: Math.PI / 4 });
    const sd = config.sensors.sampleDistance;
    const sp = computeSamplePoints(worm, config);
    const leftAngle = worm.heading - SENSOR_ANGLE_OFFSET;

    expect(sp.leftPoint.x).toBeCloseTo(worm.x + Math.cos(leftAngle) * sd, 5);
    expect(sp.leftPoint.y).toBeCloseTo(worm.y + Math.sin(leftAngle) * sd, 5);
  });

  it('should place right point at heading + SENSOR_ANGLE_OFFSET', () => {
    const config = makeConfig();
    const worm = makeWorm({ heading: Math.PI / 4 });
    const sd = config.sensors.sampleDistance;
    const sp = computeSamplePoints(worm, config);
    const rightAngle = worm.heading + SENSOR_ANGLE_OFFSET;

    expect(sp.rightPoint.x).toBeCloseTo(worm.x + Math.cos(rightAngle) * sd, 5);
    expect(sp.rightPoint.y).toBeCloseTo(worm.y + Math.sin(rightAngle) * sd, 5);
  });

  it('should respect sampleDistance config', () => {
    const config = makeConfig();
    config.sensors.sampleDistance = 12;
    const worm = makeWorm({ heading: 0 });
    const sp = computeSamplePoints(worm, config);

    const expectedFrontDist = 12 + FRONT_SENSOR_EXTRA;
    expect(sp.frontPoint.x).toBeCloseTo(worm.x + expectedFrontDist, 5);
    // Left/right distance should be 12
    const leftDist = Math.hypot(sp.leftPoint.x - worm.x, sp.leftPoint.y - worm.y);
    expect(leftDist).toBeCloseTo(12, 5);
  });

  it('should rotate all points when heading changes', () => {
    const config = makeConfig();
    const worm0 = makeWorm({ heading: 0 });
    const wormPi = makeWorm({ heading: Math.PI });

    const sp0 = computeSamplePoints(worm0, config);
    const spPi = computeSamplePoints(wormPi, config);

    // Front at heading=PI should be to the left (negative x) relative to worm
    expect(spPi.frontPoint.x).toBeLessThan(wormPi.x);
    // Front at heading=0 should be to the right (positive x)
    expect(sp0.frontPoint.x).toBeGreaterThan(worm0.x);
  });
});

// ===========================================================================
// sampleFood
// ===========================================================================

describe('sampleFood', () => {
  it('should return maximum value at food center', () => {
    const world = makeWorld();
    const value = sampleFood({ x: world.food.x, y: world.food.y }, world);
    expect(value).toBeCloseTo(world.food.strength, 5);
  });

  it('should return smaller values farther from food', () => {
    const world = makeWorld();
    const atCenter = sampleFood({ x: world.food.x, y: world.food.y }, world);
    const nearby = sampleFood({ x: world.food.x + 5, y: world.food.y }, world);
    const far = sampleFood({ x: world.food.x + 30, y: world.food.y }, world);

    expect(atCenter).toBeGreaterThan(nearby);
    expect(nearby).toBeGreaterThan(far);
  });

  it('should approach zero at large distances', () => {
    const world = makeWorld();
    const farAway = sampleFood({ x: world.food.x + 80, y: world.food.y + 80 }, world);
    expect(farAway).toBeCloseTo(0, 4);
  });

  it('should follow Gaussian profile with sigma = radius * 1.55', () => {
    const world = makeWorld();
    const sigma = world.food.radius * 1.55;
    const dx = 10;
    const expected = world.food.strength * Math.exp(-(dx * dx) / (2 * sigma * sigma));
    const actual = sampleFood({ x: world.food.x + dx, y: world.food.y }, world);
    expect(actual).toBeCloseTo(expected, 8);
  });

  it('should scale with food strength', () => {
    const world1 = makeWorld();
    world1.food.strength = 1.0;
    const world2 = makeWorld();
    world2.food.strength = 2.0;

    const v1 = sampleFood({ x: world1.food.x, y: world1.food.y }, world1);
    const v2 = sampleFood({ x: world2.food.x, y: world2.food.y }, world2);
    expect(v2).toBeCloseTo(v1 * 2, 5);
  });

  it('should be symmetric around food center', () => {
    const world = makeWorld();
    const left = sampleFood({ x: world.food.x - 10, y: world.food.y }, world);
    const right = sampleFood({ x: world.food.x + 10, y: world.food.y }, world);
    expect(left).toBeCloseTo(right, 8);
  });
});

// ===========================================================================
// sampleTemperature
// ===========================================================================

describe('sampleTemperature', () => {
  describe('mode: none', () => {
    it('should return preferredTemperature everywhere', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'none';
      config.world.preferredTemperature = 0.65;
      const world = makeWorld();

      expect(sampleTemperature({ x: 0, y: 0 }, config, world)).toBe(0.65);
      expect(sampleTemperature({ x: 50, y: 50 }, config, world)).toBe(0.65);
      expect(sampleTemperature({ x: 100, y: 100 }, config, world)).toBe(0.65);
    });
  });

  describe('mode: linear', () => {
    it('should return 0 at x=0', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'linear';
      const world = makeWorld();

      expect(sampleTemperature({ x: 0, y: 50 }, config, world)).toBeCloseTo(0, 5);
    });

    it('should return 1 at x=WORLD_SIZE', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'linear';
      const world = makeWorld();

      expect(sampleTemperature({ x: WORLD_SIZE, y: 50 }, config, world)).toBeCloseTo(1, 5);
    });

    it('should return 0.5 at x=50 (midpoint)', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'linear';
      const world = makeWorld();

      expect(sampleTemperature({ x: 50, y: 50 }, config, world)).toBeCloseTo(0.5, 5);
    });

    it('should be clamped to [0, 1]', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'linear';
      const world = makeWorld();

      // Negative x should clamp to 0
      expect(sampleTemperature({ x: -20, y: 50 }, config, world)).toBe(0);
      // Over WORLD_SIZE should clamp to 1
      expect(sampleTemperature({ x: 200, y: 50 }, config, world)).toBe(1);
    });

    it('should be independent of y coordinate', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'linear';
      const world = makeWorld();

      const atY10 = sampleTemperature({ x: 30, y: 10 }, config, world);
      const atY90 = sampleTemperature({ x: 30, y: 90 }, config, world);
      expect(atY10).toBe(atY90);
    });
  });

  describe('mode: radial', () => {
    it('should return 1 at hotspot center', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'radial';
      const hotspot = { x: 40, y: 40 };
      const world = makeWorld({ temperatureHotspot: hotspot });

      expect(sampleTemperature({ x: 40, y: 40 }, config, world)).toBeCloseTo(1, 5);
    });

    it('should decrease with distance from hotspot', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'radial';
      const hotspot = { x: 40, y: 40 };
      const world = makeWorld({ temperatureHotspot: hotspot });

      const atCenter = sampleTemperature({ x: 40, y: 40 }, config, world);
      const atDist10 = sampleTemperature({ x: 50, y: 40 }, config, world);
      const atDist30 = sampleTemperature({ x: 70, y: 40 }, config, world);

      expect(atCenter).toBeGreaterThan(atDist10);
      expect(atDist10).toBeGreaterThan(atDist30);
    });

    it('should clamp to 0 at distance >= 62', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'radial';
      const hotspot = { x: 50, y: 50 };
      const world = makeWorld({ temperatureHotspot: hotspot });

      const farAway = sampleTemperature({ x: 50 + 70, y: 50 }, config, world);
      expect(farAway).toBe(0);
    });

    it('should match formula: clamp(1 - d/62, 0, 1)', () => {
      const config = makeConfig();
      config.world.temperatureMode = 'radial';
      const hotspot = { x: 50, y: 50 };
      const world = makeWorld({ temperatureHotspot: hotspot });

      const d = 20;
      const expected = 1 - d / 62;
      const actual = sampleTemperature({ x: 50 + d, y: 50 }, config, world);
      expect(actual).toBeCloseTo(expected, 8);
    });
  });
});

// ===========================================================================
// detectCollision
// ===========================================================================

describe('detectCollision', () => {
  describe('wall collisions', () => {
    it('should detect collision at left wall (x < WALL_MARGIN)', () => {
      const world = makeWorld();
      const result = detectCollision({ x: WALL_MARGIN - 0.1, y: 50 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('wall');
    });

    it('should detect collision at right wall (x > WORLD_SIZE - WALL_MARGIN)', () => {
      const world = makeWorld();
      const result = detectCollision({ x: WORLD_SIZE - WALL_MARGIN + 0.1, y: 50 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('wall');
    });

    it('should detect collision at top wall (y < WALL_MARGIN)', () => {
      const world = makeWorld();
      const result = detectCollision({ x: 50, y: WALL_MARGIN - 0.1 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('wall');
    });

    it('should detect collision at bottom wall (y > WORLD_SIZE - WALL_MARGIN)', () => {
      const world = makeWorld();
      const result = detectCollision({ x: 50, y: WORLD_SIZE - WALL_MARGIN + 0.1 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('wall');
    });

    it('should not detect collision inside safe bounds', () => {
      const world = makeWorld();
      const result = detectCollision({ x: 50, y: 50 }, world);
      expect(result.hit).toBe(false);
      expect(result.kind).toBe('none');
    });

    it('should detect collision exactly at wall margin boundary', () => {
      const world = makeWorld();
      // x exactly at WALL_MARGIN is NOT < WALL_MARGIN, so no collision
      const atBoundary = detectCollision({ x: WALL_MARGIN, y: 50 }, world);
      expect(atBoundary.hit).toBe(false);
    });

    it('should detect collision at corner (both x and y out of bounds)', () => {
      const world = makeWorld();
      const result = detectCollision({ x: 0, y: 0 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('wall');
    });
  });

  describe('obstacle collisions', () => {
    it('should detect collision when inside obstacle radius + padding', () => {
      const world = makeWorld({
        obstacles: [{ x: 50, y: 50, r: 5 }],
      });
      // Point within r + OBSTACLE_COLLISION_PAD
      const result = detectCollision({ x: 50, y: 50 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('obstacle');
    });

    it('should not detect collision outside obstacle radius + padding', () => {
      const world = makeWorld({
        obstacles: [{ x: 50, y: 50, r: 5 }],
      });
      // Point well outside obstacle
      const result = detectCollision({ x: 70, y: 50 }, world);
      expect(result.hit).toBe(false);
    });

    it('should detect collision at edge of obstacle + pad', () => {
      const world = makeWorld({
        obstacles: [{ x: 50, y: 50, r: 5 }],
      });
      // Just inside the collision radius (r + pad = 5 + 1.2 = 6.2)
      const result = detectCollision({ x: 50 + 6.1, y: 50 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('obstacle');
    });

    it('should check all obstacles', () => {
      const world = makeWorld({
        obstacles: [
          { x: 20, y: 20, r: 3 },
          { x: 80, y: 80, r: 3 },
        ],
      });
      const result = detectCollision({ x: 80, y: 80 }, world);
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('obstacle');
    });

    it('should return no collision with empty obstacles array', () => {
      const world = makeWorld({ obstacles: [] });
      const result = detectCollision({ x: 50, y: 50 }, world);
      expect(result.hit).toBe(false);
      expect(result.kind).toBe('none');
    });

    it('wall collision takes priority over obstacle (checked first)', () => {
      // Place an obstacle at the wall edge
      const world = makeWorld({
        obstacles: [{ x: 0, y: 0, r: 5 }],
      });
      const result = detectCollision({ x: 0, y: 0 }, world);
      // Wall is checked first
      expect(result.hit).toBe(true);
      expect(result.kind).toBe('wall');
    });
  });
});
