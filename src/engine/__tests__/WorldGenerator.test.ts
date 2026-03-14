// ============================================================================
// WorldGenerator Tests
// Covers: deterministic generation, seed variation, obstacle placement rules,
//         food placement, temperature hotspot, config parameter effects
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateWorld } from '../WorldGenerator';
import { DEFAULT_CONFIG } from '../constants';
import { deepClone } from '../math';
import type { SimConfig } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Record<string, unknown> = {}): SimConfig {
  const cfg = deepClone(DEFAULT_CONFIG) as SimConfig;
  if (overrides.world) Object.assign(cfg.world, overrides.world);
  return cfg;
}

// ===========================================================================
// Deterministic generation
// ===========================================================================

describe('WorldGenerator determinism', () => {
  it('should produce identical worlds from the same seed and config', () => {
    const config = makeConfig();
    const world1 = generateWorld(config, 'test-seed-42');
    const world2 = generateWorld(config, 'test-seed-42');

    expect(world1.food.x).toBe(world2.food.x);
    expect(world1.food.y).toBe(world2.food.y);
    expect(world1.food.radius).toBe(world2.food.radius);
    expect(world1.food.strength).toBe(world2.food.strength);
    expect(world1.obstacles.length).toBe(world2.obstacles.length);
    for (let i = 0; i < world1.obstacles.length; i++) {
      expect(world1.obstacles[i].x).toBe(world2.obstacles[i].x);
      expect(world1.obstacles[i].y).toBe(world2.obstacles[i].y);
      expect(world1.obstacles[i].r).toBe(world2.obstacles[i].r);
    }
    expect(world1.temperatureHotspot.x).toBe(world2.temperatureHotspot.x);
    expect(world1.temperatureHotspot.y).toBe(world2.temperatureHotspot.y);
  });

  it('should produce identical results across multiple calls (no hidden state)', () => {
    const config = makeConfig();
    const seed = 'determinism-check';

    const world1 = generateWorld(config, seed);
    // Generate a different world in between
    generateWorld(config, 'other-seed');
    const world2 = generateWorld(config, seed);

    expect(world1.food.x).toBe(world2.food.x);
    expect(world1.food.y).toBe(world2.food.y);
    expect(world1.obstacles.length).toBe(world2.obstacles.length);
  });
});

// ===========================================================================
// Seed variation
// ===========================================================================

describe('WorldGenerator seed variation', () => {
  it('should produce different worlds from different seeds', () => {
    const config = makeConfig();
    const worldA = generateWorld(config, 'seed-alpha');
    const worldB = generateWorld(config, 'seed-beta');

    // At least one property should differ
    const foodSame = worldA.food.x === worldB.food.x && worldA.food.y === worldB.food.y;
    const hotspotSame =
      worldA.temperatureHotspot.x === worldB.temperatureHotspot.x &&
      worldA.temperatureHotspot.y === worldB.temperatureHotspot.y;

    // Extremely unlikely that both food AND hotspot match
    expect(foodSame && hotspotSame).toBe(false);
  });

  it('should change world when obstacleDensity changes (part of seed hash)', () => {
    const config1 = makeConfig({ world: { obstacleDensity: 0.05 } });
    const config2 = makeConfig({ world: { obstacleDensity: 0.15 } });
    const seed = 'density-test';

    const world1 = generateWorld(config1, seed);
    const world2 = generateWorld(config2, seed);

    // Different density => different obstacle count (and different RNG path)
    expect(world1.obstacles.length).not.toBe(world2.obstacles.length);
  });

  it('should change world when foodRadius changes (part of seed hash)', () => {
    const config1 = makeConfig({ world: { foodRadius: 8 } });
    const config2 = makeConfig({ world: { foodRadius: 20 } });
    const seed = 'radius-test';

    const world1 = generateWorld(config1, seed);
    const world2 = generateWorld(config2, seed);

    expect(world1.food.radius).not.toBe(world2.food.radius);
  });

  it('should change world when temperatureMode changes (part of seed hash)', () => {
    const config1 = makeConfig({ world: { temperatureMode: 'none' } });
    const config2 = makeConfig({ world: { temperatureMode: 'linear' } });
    const seed = 'temp-mode-test';

    const world1 = generateWorld(config1, seed);
    const world2 = generateWorld(config2, seed);

    // Different temperature mode -> different RNG seed -> different food position
    const foodSame = world1.food.x === world2.food.x && world1.food.y === world2.food.y;
    expect(foodSame).toBe(false);
  });
});

// ===========================================================================
// Food placement
// ===========================================================================

describe('WorldGenerator food placement', () => {
  it('should place food near (72, 28) with small random offset', () => {
    const config = makeConfig();
    const world = generateWorld(config, 'food-pos');

    // Food center is 72 + [-4, 4], 28 + [-5, 5]
    expect(world.food.x).toBeGreaterThanOrEqual(72 - 4);
    expect(world.food.x).toBeLessThanOrEqual(72 + 4);
    expect(world.food.y).toBeGreaterThanOrEqual(28 - 5);
    expect(world.food.y).toBeLessThanOrEqual(28 + 5);
  });

  it('should use config foodRadius and foodStrength', () => {
    const config = makeConfig({ world: { foodRadius: 20, foodStrength: 2.5 } });
    const world = generateWorld(config, 'food-config');

    expect(world.food.radius).toBe(20);
    expect(world.food.strength).toBe(2.5);
  });
});

// ===========================================================================
// Obstacle placement
// ===========================================================================

describe('WorldGenerator obstacle placement', () => {
  it('should place correct number of obstacles based on density', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.1 } });
    const world = generateWorld(config, 'obs-count');
    const expected = Math.round(0.1 * 42);

    // Might be fewer if placement fails (collision avoidance), but should not exceed
    expect(world.obstacles.length).toBeLessThanOrEqual(expected);
    // With density 0.1 (target 4), we should get at least 1
    expect(world.obstacles.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce zero obstacles at density 0', () => {
    const config = makeConfig({ world: { obstacleDensity: 0 } });
    const world = generateWorld(config, 'zero-obs');

    expect(world.obstacles.length).toBe(0);
  });

  it('should place obstacles far enough from food patch', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.2 } });
    const world = generateWorld(config, 'obs-food-dist');

    for (const obstacle of world.obstacles) {
      const distToFood = Math.hypot(obstacle.x - world.food.x, obstacle.y - world.food.y);
      expect(distToFood).toBeGreaterThan(world.food.radius + obstacle.r + 8 - 0.01);
    }
  });

  it('should place obstacles far enough from start position (18, 72)', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.2 } });
    const world = generateWorld(config, 'obs-start-dist');

    for (const obstacle of world.obstacles) {
      const distToStart = Math.hypot(obstacle.x - 18, obstacle.y - 72);
      expect(distToStart).toBeGreaterThan(obstacle.r + 8 - 0.01);
    }
  });

  it('should not place overlapping obstacles', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.25 } });
    const world = generateWorld(config, 'obs-overlap');

    for (let i = 0; i < world.obstacles.length; i++) {
      for (let j = i + 1; j < world.obstacles.length; j++) {
        const dist = Math.hypot(
          world.obstacles[i].x - world.obstacles[j].x,
          world.obstacles[i].y - world.obstacles[j].y,
        );
        const minDist = world.obstacles[i].r + world.obstacles[j].r + 3.4;
        expect(dist).toBeGreaterThanOrEqual(minDist - 0.01);
      }
    }
  });

  it('should place obstacles within the world bounds (12-88 range)', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.15 } });
    const world = generateWorld(config, 'obs-bounds');

    for (const obstacle of world.obstacles) {
      expect(obstacle.x).toBeGreaterThanOrEqual(12);
      expect(obstacle.x).toBeLessThanOrEqual(88);
      expect(obstacle.y).toBeGreaterThanOrEqual(12);
      expect(obstacle.y).toBeLessThanOrEqual(88);
    }
  });

  it('should have obstacle radii in range [2.4, 7.2]', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.2 } });
    const world = generateWorld(config, 'obs-radius');

    for (const obstacle of world.obstacles) {
      expect(obstacle.r).toBeGreaterThanOrEqual(2.4);
      expect(obstacle.r).toBeLessThanOrEqual(7.2);
    }
  });
});

// ===========================================================================
// Temperature hotspot
// ===========================================================================

describe('WorldGenerator temperature hotspot', () => {
  it('should place hotspot within expected range', () => {
    const config = makeConfig();
    const world = generateWorld(config, 'hotspot-pos');

    // Hotspot x: 36 + [0, 28], y: 24 + [0, 42]
    expect(world.temperatureHotspot.x).toBeGreaterThanOrEqual(36);
    expect(world.temperatureHotspot.x).toBeLessThanOrEqual(64);
    expect(world.temperatureHotspot.y).toBeGreaterThanOrEqual(24);
    expect(world.temperatureHotspot.y).toBeLessThanOrEqual(66);
  });

  it('should vary hotspot position with seed', () => {
    const config = makeConfig();
    const world1 = generateWorld(config, 'hotspot-a');
    const world2 = generateWorld(config, 'hotspot-b');

    const same =
      world1.temperatureHotspot.x === world2.temperatureHotspot.x &&
      world1.temperatureHotspot.y === world2.temperatureHotspot.y;
    expect(same).toBe(false);
  });
});

// ===========================================================================
// Multiple seeds stress test
// ===========================================================================

describe('WorldGenerator stress test', () => {
  it('should produce valid worlds for many different seeds', () => {
    const config = makeConfig({ world: { obstacleDensity: 0.12 } });

    for (let i = 0; i < 20; i++) {
      const seed = `stress-test-${i}`;
      const world = generateWorld(config, seed);

      // Food should exist
      expect(world.food).toBeDefined();
      expect(world.food.radius).toBeGreaterThan(0);

      // Obstacles should be valid
      for (const obs of world.obstacles) {
        expect(obs.r).toBeGreaterThan(0);
        expect(Number.isFinite(obs.x)).toBe(true);
        expect(Number.isFinite(obs.y)).toBe(true);
      }

      // Hotspot should be valid
      expect(Number.isFinite(world.temperatureHotspot.x)).toBe(true);
      expect(Number.isFinite(world.temperatureHotspot.y)).toBe(true);
    }
  });
});
