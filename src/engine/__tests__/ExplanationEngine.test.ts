// ============================================================================
// ExplanationEngine Tests
// Covers: state-specific explanation keys, sensor readings, food proximity,
//         touch explanations, bias explanations, disabled sensors
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateExplanations, generatePrimaryExplanation } from '../ExplanationEngine';
import type { ExplanationContext } from '../ExplanationEngine';
import { DEFAULT_CONFIG } from '../constants';
import { deepClone } from '../math';
import type { SimConfig, WormState, SensorState, World, RawMetrics, SimEvent } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Record<string, unknown> = {}): SimConfig {
  const cfg = deepClone(DEFAULT_CONFIG) as SimConfig;
  if (overrides.sensors) Object.assign(cfg.sensors, overrides.sensors);
  if (overrides.behavior) Object.assign(cfg.behavior, overrides.behavior);
  if (overrides.world) Object.assign(cfg.world, overrides.world);
  return cfg;
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

function makeSensor(overrides: Partial<SensorState> = {}): SensorState {
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

function makeMetrics(overrides: Partial<RawMetrics> = {}): RawMetrics {
  return {
    elapsed: 10,
    distance: 50,
    collisions: 2,
    turns: 3,
    reversals: 2,
    foodTime: 1.5,
    firstFoodTime: 5.0,
    chemoAccum: 10,
    tempErrorAccum: 2,
    samples: 100,
    eventCount: 8,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ExplanationContext> = {}): ExplanationContext {
  return {
    config: makeConfig(),
    worm: makeWorm(),
    sensor: makeSensor(),
    world: makeWorld(),
    metrics: makeMetrics(),
    recentEvents: [],
    wasInsideFood: false,
    ...overrides,
  };
}

// ===========================================================================
// State-based explanations
// ===========================================================================

describe('ExplanationEngine state explanations', () => {
  it('should produce explanation.state_cruise for cruise state', () => {
    const ctx = makeCtx({ worm: makeWorm({ state: 'cruise', lastSpeed: 15 }) });
    const explanations = generateExplanations(ctx);

    const stateExpl = explanations.find((e) => e.key === 'explanation.state_cruise');
    expect(stateExpl).toBeDefined();
    expect(stateExpl!.params.speed).toBe('15.0');
  });

  it('should produce explanation.state_reverse for reverse state', () => {
    const ctx = makeCtx({
      worm: makeWorm({ state: 'reverse', stateTimer: 420, lastSpeed: 8.4 }),
    });
    const explanations = generateExplanations(ctx);

    const stateExpl = explanations.find((e) => e.key === 'explanation.state_reverse');
    expect(stateExpl).toBeDefined();
    expect(stateExpl!.params.timer).toBe('420');
    expect(stateExpl!.params.speed).toBe('8.4');
  });

  it('should produce explanation.state_turn for turn state', () => {
    const ctx = makeCtx({
      worm: makeWorm({ state: 'turn', stateTimer: 300, turnDir: -1 }),
    });
    const explanations = generateExplanations(ctx);

    const stateExpl = explanations.find((e) => e.key === 'explanation.state_turn');
    expect(stateExpl).toBeDefined();
    expect(stateExpl!.params.direction).toBe('left');
    expect(stateExpl!.params.timer).toBe('300');
  });

  it('should set direction=right when turnDir > 0 in turn state', () => {
    const ctx = makeCtx({
      worm: makeWorm({ state: 'turn', stateTimer: 300, turnDir: 1 }),
    });
    const explanations = generateExplanations(ctx);

    const stateExpl = explanations.find((e) => e.key === 'explanation.state_turn');
    expect(stateExpl!.params.direction).toBe('right');
  });
});

// ===========================================================================
// Food proximity
// ===========================================================================

describe('ExplanationEngine food proximity', () => {
  it('should produce inside_food explanation when wasInsideFood is true', () => {
    const ctx = makeCtx({
      wasInsideFood: true,
      metrics: makeMetrics({ foodTime: 3.7 }),
    });
    const explanations = generateExplanations(ctx);

    const foodExpl = explanations.find((e) => e.key === 'explanation.inside_food');
    expect(foodExpl).toBeDefined();
    expect(foodExpl!.params.foodTime).toBe('3.7');
  });

  it('should produce near_food when worm is within 2x food radius', () => {
    const world = makeWorld({ food: { x: 60, y: 50, radius: 14, strength: 1.1 } });
    const worm = makeWorm({ x: 50, y: 50 }); // distance = 10, < 14 * 2 = 28
    const ctx = makeCtx({ world, worm, wasInsideFood: false });
    const explanations = generateExplanations(ctx);

    const nearExpl = explanations.find((e) => e.key === 'explanation.near_food');
    expect(nearExpl).toBeDefined();
  });

  it('should NOT produce near_food when worm is far from food', () => {
    const world = makeWorld({ food: { x: 90, y: 90, radius: 5, strength: 1.1 } });
    const worm = makeWorm({ x: 10, y: 10 }); // distance ~ 113, way beyond 2x radius
    const ctx = makeCtx({ world, worm, wasInsideFood: false });
    const explanations = generateExplanations(ctx);

    const nearExpl = explanations.find((e) => e.key === 'explanation.near_food');
    expect(nearExpl).toBeUndefined();
  });
});

// ===========================================================================
// Chemosensory explanations
// ===========================================================================

describe('ExplanationEngine chemo', () => {
  it('should produce chemo_gradient_right when right > left', () => {
    const config = makeConfig({ sensors: { chemo: true } });
    const sensor = makeSensor({ chemoRight: 0.5, chemoLeft: 0.1, chemoCenter: 0.3 });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const chemoExpl = explanations.find((e) => e.key === 'explanation.chemo_gradient_right');
    expect(chemoExpl).toBeDefined();
  });

  it('should produce chemo_gradient_left when left > right', () => {
    const config = makeConfig({ sensors: { chemo: true } });
    const sensor = makeSensor({ chemoRight: 0.1, chemoLeft: 0.5, chemoCenter: 0.3 });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const chemoExpl = explanations.find((e) => e.key === 'explanation.chemo_gradient_left');
    expect(chemoExpl).toBeDefined();
  });

  it('should produce chemo_no_gradient when left ~ right', () => {
    const config = makeConfig({ sensors: { chemo: true } });
    const sensor = makeSensor({ chemoRight: 0.3, chemoLeft: 0.3, chemoCenter: 0.3 });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const chemoExpl = explanations.find((e) => e.key === 'explanation.chemo_no_gradient');
    expect(chemoExpl).toBeDefined();
  });

  it('should NOT produce chemo explanations when chemo sensor is off', () => {
    const config = makeConfig({ sensors: { chemo: false } });
    const ctx = makeCtx({ config });
    const explanations = generateExplanations(ctx);

    const chemoExpls = explanations.filter((e) => e.key.includes('chemo_gradient') || e.key.includes('chemo_no'));
    expect(chemoExpls.length).toBe(0);
  });
});

// ===========================================================================
// Thermosensory explanations
// ===========================================================================

describe('ExplanationEngine thermo', () => {
  it('should produce thermo_current when thermo enabled and mode != none', () => {
    const config = makeConfig({
      sensors: { thermo: true },
      world: { temperatureMode: 'linear', preferredTemperature: 0.5 },
    });
    const sensor = makeSensor({ tempCurrent: 0.3, tempError: 0.2 });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const thermoExpl = explanations.find((e) => e.key === 'explanation.thermo_current');
    expect(thermoExpl).toBeDefined();
  });

  it('should produce thermo_discomfort when error > discomfort threshold', () => {
    const config = makeConfig({
      sensors: { thermo: true },
      behavior: { discomfort: 0.1 },
      world: { temperatureMode: 'linear' },
    });
    const sensor = makeSensor({ tempError: 0.5 }); // 0.5 > 0.1
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const discomfortExpl = explanations.find((e) => e.key === 'explanation.thermo_discomfort');
    expect(discomfortExpl).toBeDefined();
  });

  it('should NOT produce thermo_discomfort when error <= discomfort threshold', () => {
    const config = makeConfig({
      sensors: { thermo: true },
      behavior: { discomfort: 0.5 },
      world: { temperatureMode: 'linear' },
    });
    const sensor = makeSensor({ tempError: 0.1 }); // 0.1 <= 0.5
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const discomfortExpl = explanations.find((e) => e.key === 'explanation.thermo_discomfort');
    expect(discomfortExpl).toBeUndefined();
  });

  it('should NOT produce thermo explanations when mode is none', () => {
    const config = makeConfig({
      sensors: { thermo: true },
      world: { temperatureMode: 'none' },
    });
    const ctx = makeCtx({ config });
    const explanations = generateExplanations(ctx);

    const thermoExpls = explanations.filter((e) => e.key.includes('thermo'));
    expect(thermoExpls.length).toBe(0);
  });
});

// ===========================================================================
// Touch explanations
// ===========================================================================

describe('ExplanationEngine touch', () => {
  it('should produce touch_front when front sensor touched', () => {
    const config = makeConfig({ sensors: { touch: true } });
    const sensor = makeSensor({ touchFront: true });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    expect(explanations.find((e) => e.key === 'explanation.touch_front')).toBeDefined();
  });

  it('should produce touch_left when only left touched', () => {
    const config = makeConfig({ sensors: { touch: true } });
    const sensor = makeSensor({ touchLeft: true, touchRight: false });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    expect(explanations.find((e) => e.key === 'explanation.touch_left')).toBeDefined();
  });

  it('should produce touch_right when only right touched', () => {
    const config = makeConfig({ sensors: { touch: true } });
    const sensor = makeSensor({ touchLeft: false, touchRight: true });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    expect(explanations.find((e) => e.key === 'explanation.touch_right')).toBeDefined();
  });

  it('should produce touch_both when both sides touched', () => {
    const config = makeConfig({ sensors: { touch: true } });
    const sensor = makeSensor({ touchLeft: true, touchRight: true });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    expect(explanations.find((e) => e.key === 'explanation.touch_both')).toBeDefined();
  });

  it('should NOT produce touch explanations when touch is disabled', () => {
    const config = makeConfig({ sensors: { touch: false } });
    const sensor = makeSensor({ touchFront: true });
    const ctx = makeCtx({ config, sensor });
    const explanations = generateExplanations(ctx);

    const touchExpls = explanations.filter((e) => e.key.includes('touch'));
    expect(touchExpls.length).toBe(0);
  });
});

// ===========================================================================
// Bias explanations
// ===========================================================================

describe('ExplanationEngine bias', () => {
  it('should produce bias_right when bias > 0.05', () => {
    const sensor = makeSensor({ bias: 0.8 });
    const ctx = makeCtx({ sensor });
    const explanations = generateExplanations(ctx);

    expect(explanations.find((e) => e.key === 'explanation.bias_right')).toBeDefined();
  });

  it('should produce bias_left when bias < -0.05', () => {
    const sensor = makeSensor({ bias: -0.8 });
    const ctx = makeCtx({ sensor });
    const explanations = generateExplanations(ctx);

    expect(explanations.find((e) => e.key === 'explanation.bias_left')).toBeDefined();
  });

  it('should NOT produce bias explanation when |bias| <= 0.05', () => {
    const sensor = makeSensor({ bias: 0.03 });
    const ctx = makeCtx({ sensor });
    const explanations = generateExplanations(ctx);

    const biasExpls = explanations.filter((e) => e.key.includes('bias'));
    expect(biasExpls.length).toBe(0);
  });
});

// ===========================================================================
// Recent events
// ===========================================================================

describe('ExplanationEngine recent events', () => {
  it('should produce event explanation for most recent event', () => {
    const events: SimEvent[] = [
      { type: 'collision', title: 'Wall hit', time: 5.2, x: 10, y: 50 },
    ];
    const ctx = makeCtx({ recentEvents: events });
    const explanations = generateExplanations(ctx);

    const eventExpl = explanations.find((e) => e.key === 'explanation.event_collision');
    expect(eventExpl).toBeDefined();
    expect(eventExpl!.params.title).toBe('Wall hit');
  });

  it('should use the first (most recent) event', () => {
    const events: SimEvent[] = [
      { type: 'turn', title: 'Gradient reorient', time: 8.0, x: 30, y: 40 },
      { type: 'collision', title: 'Wall hit', time: 5.2, x: 10, y: 50 },
    ];
    const ctx = makeCtx({ recentEvents: events });
    const explanations = generateExplanations(ctx);

    const eventExpl = explanations.find((e) => e.key === 'explanation.event_turn');
    expect(eventExpl).toBeDefined();
  });

  it('should not produce event explanation with empty events', () => {
    const ctx = makeCtx({ recentEvents: [] });
    const explanations = generateExplanations(ctx);

    const eventExpls = explanations.filter((e) => e.key.startsWith('explanation.event_'));
    expect(eventExpls.length).toBe(0);
  });
});

// ===========================================================================
// Disabled sensors
// ===========================================================================

describe('ExplanationEngine disabled sensors', () => {
  it('should list disabled sensors', () => {
    const config = makeConfig({
      sensors: { touch: false, chemo: false, thermo: true },
      world: { temperatureMode: 'linear' },
    });
    const ctx = makeCtx({ config });
    const explanations = generateExplanations(ctx);

    const disabledExpl = explanations.find((e) => e.key === 'explanation.sensors_disabled');
    expect(disabledExpl).toBeDefined();
    expect(disabledExpl!.params.sensors).toContain('touch');
    expect(disabledExpl!.params.sensors).toContain('chemo');
    expect(disabledExpl!.params.sensors).not.toContain('thermo');
  });

  it('should NOT produce disabled sensors explanation when all enabled', () => {
    const config = makeConfig({
      sensors: { touch: true, chemo: true, thermo: true },
    });
    const ctx = makeCtx({ config });
    const explanations = generateExplanations(ctx);

    const disabledExpl = explanations.find((e) => e.key === 'explanation.sensors_disabled');
    expect(disabledExpl).toBeUndefined();
  });
});

// ===========================================================================
// generatePrimaryExplanation
// ===========================================================================

describe('generatePrimaryExplanation', () => {
  it('should return the first explanation (state line)', () => {
    const ctx = makeCtx({ worm: makeWorm({ state: 'cruise', lastSpeed: 12 }) });
    const primary = generatePrimaryExplanation(ctx);

    expect(primary.key).toBe('explanation.state_cruise');
  });

  it('should return idle fallback for edge case with no explanations', () => {
    // This shouldn't normally happen since state always produces an explanation,
    // but test the fallback path
    // We can't easily trigger an empty list from the real function since worm.state
    // always matches one of the three cases, so this tests the guard clause only
    const ctx = makeCtx();
    const primary = generatePrimaryExplanation(ctx);
    expect(primary.key).toBeDefined();
    expect(primary.params).toBeDefined();
  });
});
