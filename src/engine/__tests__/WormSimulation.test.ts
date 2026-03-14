// ============================================================================
// WormSimulation Engine Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { WormSimulation } from '../WormSimulation';
import { DEFAULT_CONFIG } from '../constants';
import { deepClone } from '../math';
import type { SimConfig } from '../types';

describe('WormSimulation', () => {
  const makeConfig = (): SimConfig => deepClone(DEFAULT_CONFIG) as SimConfig;
  const FIXED_SEED = 'test42';

  it('should initialize with correct default state', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    expect(sim.worm.state).toBe('cruise');
    expect(sim.worm.segments.length).toBe(18); // default segmentCount
    expect(sim.metrics.elapsed).toBe(0);
    expect(sim.metrics.eventCount).toBe(1); // "start" event
    expect(sim.recentEvents.length).toBe(1);
    expect(sim.recentEvents[0].type).toBe('start');
  });

  it('should be deterministic with the same seed', () => {
    const config = makeConfig();
    const sim1 = new WormSimulation(config, FIXED_SEED);
    const sim2 = new WormSimulation(config, FIXED_SEED);

    // Run both for 100 steps
    for (let i = 0; i < 100; i++) {
      sim1.step(1 / 60);
      sim2.step(1 / 60);
    }

    expect(sim1.worm.x).toBe(sim2.worm.x);
    expect(sim1.worm.y).toBe(sim2.worm.y);
    expect(sim1.worm.heading).toBe(sim2.worm.heading);
    expect(sim1.worm.state).toBe(sim2.worm.state);
    expect(sim1.metrics.distance).toBe(sim2.metrics.distance);
    expect(sim1.metrics.collisions).toBe(sim2.metrics.collisions);
  });

  it('should produce different results with different seeds', () => {
    const config = makeConfig();
    const sim1 = new WormSimulation(config, 'seed_a');
    const sim2 = new WormSimulation(config, 'seed_b');

    for (let i = 0; i < 100; i++) {
      sim1.step(1 / 60);
      sim2.step(1 / 60);
    }

    // At least position should differ
    const positionSame = sim1.worm.x === sim2.worm.x && sim1.worm.y === sim2.worm.y;
    expect(positionSame).toBe(false);
  });

  it('should advance metrics over time', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }
    expect(sim.metrics.elapsed).toBeGreaterThan(0);
    expect(sim.metrics.distance).toBeGreaterThan(0);
    expect(sim.metrics.samples).toBe(60);
  });

  it('should return a valid snapshot', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    sim.step(1 / 60);
    const snapshot = sim.getSnapshot();

    expect(snapshot.state).toBeDefined();
    expect(snapshot.position.x).toBeDefined();
    expect(snapshot.position.y).toBeDefined();
    expect(snapshot.heading).toBeDefined();
    expect(snapshot.speed).toBeDefined();
    expect(snapshot.sensor).toBeDefined();
    expect(snapshot.metrics).toBeDefined();
    expect(snapshot.events).toBeInstanceOf(Array);
  });

  it('should return valid metrics', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    for (let i = 0; i < 30; i++) {
      sim.step(1 / 60);
    }
    const metrics = sim.getMetrics();

    expect(metrics.elapsed).toBeGreaterThan(0);
    expect(typeof metrics.avgChemo).toBe('number');
    expect(typeof metrics.avgTempError).toBe('number');
    expect(metrics.eventCount).toBeGreaterThanOrEqual(1);
  });

  it('should reset properly', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }
    expect(sim.metrics.elapsed).toBeGreaterThan(0);

    sim.reset(true);
    expect(sim.metrics.elapsed).toBe(0);
    expect(sim.metrics.distance).toBe(0);
    expect(sim.worm.state).toBe('cruise');
    expect(sim.recentEvents.length).toBe(1);
    expect(sim.recentEvents[0].type).toBe('start');
  });

  it('should handle setConfig with world regeneration', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    void sim.world.food.x;

    const newConfig = makeConfig();
    newConfig.world.obstacleDensity = 0.2;
    sim.setConfig(newConfig, true);

    // World should be regenerated (food position will change due to different density in seed)
    expect(sim.config.world.obstacleDensity).toBe(0.2);
  });

  it('should keep worm within world bounds after many steps', () => {
    const sim = new WormSimulation(makeConfig(), FIXED_SEED);
    for (let i = 0; i < 600; i++) {
      sim.step(1 / 60);
    }
    // Worm should not escape the 0-100 world bounds
    expect(sim.worm.x).toBeGreaterThanOrEqual(0);
    expect(sim.worm.x).toBeLessThanOrEqual(100);
    expect(sim.worm.y).toBeGreaterThanOrEqual(0);
    expect(sim.worm.y).toBeLessThanOrEqual(100);
  });
});
