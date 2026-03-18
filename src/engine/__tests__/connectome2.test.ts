import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, WALL_MARGIN, WORLD_SIZE } from '../constants';
import { buildConnectome2Frame } from '../connectome2';
import { deepClone } from '../math';
import type { SimConfig } from '../types';
import { WormSimulation } from '../WormSimulation';

function makeConfig(): SimConfig {
  return deepClone(DEFAULT_CONFIG) as SimConfig;
}

describe('buildConnectome2Frame', () => {
  it('keeps forward drive dominant during an unobstructed cruise', () => {
    const config = makeConfig();
    config.sensors.touch = false;
    config.sensors.thermo = false;
    config.behavior.turnProbability = 0;
    config.behavior.exploration = 0;
    const sim = new WormSimulation(config, 'connectome2-forward');

    for (let step = 0; step < 20; step += 1) {
      sim.step(1 / 60);
    }

    const frame = buildConnectome2Frame(sim, sim.getSnapshot());
    expect(frame.forwardDrive).toBeGreaterThan(frame.reverseDrive);
    expect(frame.readout.predictedState).toContain('cruise');
  });

  it('switches to withdrawal-dominant readout after a front collision', () => {
    const config = makeConfig();
    config.sensors.touch = true;
    config.sensors.chemo = false;
    config.sensors.thermo = false;

    const sim = new WormSimulation(config, 'connectome2-reverse');
    sim.worm.x = WORLD_SIZE - WALL_MARGIN - 1;
    sim.worm.y = 50;
    sim.worm.heading = 0;
    sim.worm.state = 'cruise';

    sim.step(1 / 60);

    const frame = buildConnectome2Frame(sim, sim.getSnapshot());
    expect(sim.getSnapshot().state).toBe('reverse');
    expect(frame.reverseDrive).toBeGreaterThan(frame.forwardDrive);
    expect(frame.readout.predictedState).toContain('reverse');
    expect(frame.narrative.route.some((name) => name.startsWith('AVA'))).toBe(true);
  });

  it('reflects a rightward chemical gradient in the live signals', () => {
    const config = makeConfig();
    config.sensors.touch = false;
    config.sensors.thermo = false;
    config.sensors.chemo = true;
    config.sensors.noise = 0;

    const sim = new WormSimulation(config, 'connectome2-chemo');
    sim.worm.x = 40;
    sim.worm.y = 50;
    sim.worm.heading = 0;
    sim.world.food.x = 50;
    sim.world.food.y = 56;
    sim.world.food.radius = 16;
    sim.world.food.strength = 1.3;

    sim.step(1 / 60);

    const frame = buildConnectome2Frame(sim, sim.getSnapshot());
    const chemoSignal = frame.signals.find((signal) => signal.key === 'chemo');

    expect(chemoSignal?.polarity).toBe('right');
    expect(frame.forwardDrive).toBeGreaterThan(frame.reverseDrive);
  });
});
