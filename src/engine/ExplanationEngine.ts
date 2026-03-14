// ============================================================================
// Nema Lab Simulation Engine — Explanation Engine
// Pure TypeScript, zero browser/DOM/Canvas dependencies
//
// Converts SimState + recent events into i18n-key-based natural language
// explanations. The renderer/UI layer looks up these keys via react-i18next.
// ============================================================================

import type {
  SimConfig,
  WormState,
  SensorState,
  World,
  RawMetrics,
  SimEvent,
  Explanation,
} from './types';
import { formatNumber } from './math';

// ---------------------------------------------------------------------------
// Context for explanation generation
// ---------------------------------------------------------------------------

export interface ExplanationContext {
  config: SimConfig;
  worm: WormState;
  sensor: SensorState;
  world: World;
  metrics: RawMetrics;
  recentEvents: SimEvent[];
  wasInsideFood: boolean;
}

// ---------------------------------------------------------------------------
// Explanation Generator
// ---------------------------------------------------------------------------

/**
 * Generate an array of i18n-key-based explanation lines describing
 * the worm's current behavioral state, sensor readings, and recent events.
 *
 * Each Explanation has:
 * - `key`: an i18n translation key (e.g. 'explanation.cruising_toward_food')
 * - `params`: interpolation variables for the i18n template
 *
 * The UI layer calls `t(explanation.key, explanation.params)` to render.
 */
export function generateExplanations(ctx: ExplanationContext): Explanation[] {
  const explanations: Explanation[] = [];
  const { config, worm, sensor, world, metrics, wasInsideFood } = ctx;

  // --- 1. Current behavioral state ---
  switch (worm.state) {
    case 'cruise':
      explanations.push({
        key: 'explanation.state_cruise',
        params: { speed: formatNumber(worm.lastSpeed, 1) },
      });
      break;
    case 'reverse':
      explanations.push({
        key: 'explanation.state_reverse',
        params: {
          timer: formatNumber(worm.stateTimer, 0),
          speed: formatNumber(worm.lastSpeed, 1),
        },
      });
      break;
    case 'turn':
      explanations.push({
        key: 'explanation.state_turn',
        params: {
          direction: worm.turnDir > 0 ? 'right' : 'left',
          timer: formatNumber(worm.stateTimer, 0),
        },
      });
      break;
  }

  // --- 2. Food proximity ---
  if (wasInsideFood) {
    explanations.push({
      key: 'explanation.inside_food',
      params: {
        foodTime: formatNumber(metrics.foodTime, 1),
      },
    });
  } else {
    const distToFood = Math.hypot(worm.x - world.food.x, worm.y - world.food.y);
    if (distToFood < world.food.radius * 2) {
      explanations.push({
        key: 'explanation.near_food',
        params: { distance: formatNumber(distToFood, 1) },
      });
    }
  }

  // --- 3. Chemosensory gradient ---
  if (config.sensors.chemo) {
    const chemoDiff = sensor.chemoRight - sensor.chemoLeft;
    if (Math.abs(chemoDiff) > 0.001) {
      explanations.push({
        key: chemoDiff > 0
          ? 'explanation.chemo_gradient_right'
          : 'explanation.chemo_gradient_left',
        params: {
          strength: formatNumber(Math.abs(chemoDiff), 4),
          center: formatNumber(sensor.chemoCenter, 4),
        },
      });
    } else {
      explanations.push({
        key: 'explanation.chemo_no_gradient',
        params: { center: formatNumber(sensor.chemoCenter, 4) },
      });
    }
  }

  // --- 4. Thermosensory ---
  if (config.sensors.thermo && config.world.temperatureMode !== 'none') {
    explanations.push({
      key: 'explanation.thermo_current',
      params: {
        current: formatNumber(sensor.tempCurrent, 2),
        preferred: formatNumber(config.world.preferredTemperature, 2),
        error: formatNumber(sensor.tempError, 3),
      },
    });
    if (sensor.tempError > config.behavior.discomfort) {
      explanations.push({
        key: 'explanation.thermo_discomfort',
        params: {
          error: formatNumber(sensor.tempError, 3),
          threshold: formatNumber(config.behavior.discomfort, 2),
        },
      });
    }
  }

  // --- 5. Touch sensors ---
  if (config.sensors.touch) {
    if (sensor.touchFront) {
      explanations.push({ key: 'explanation.touch_front', params: {} });
    }
    if (sensor.touchLeft && !sensor.touchRight) {
      explanations.push({ key: 'explanation.touch_left', params: {} });
    }
    if (sensor.touchRight && !sensor.touchLeft) {
      explanations.push({ key: 'explanation.touch_right', params: {} });
    }
    if (sensor.touchLeft && sensor.touchRight) {
      explanations.push({ key: 'explanation.touch_both', params: {} });
    }
  }

  // --- 6. Most recent event ---
  if (ctx.recentEvents.length > 0) {
    const latest = ctx.recentEvents[0];
    explanations.push({
      key: `explanation.event_${latest.type}`,
      params: {
        time: formatNumber(latest.time, 1),
        title: latest.title,
      },
    });
  }

  // --- 7. Combined bias ---
  if (Math.abs(sensor.bias) > 0.05) {
    explanations.push({
      key: sensor.bias > 0 ? 'explanation.bias_right' : 'explanation.bias_left',
      params: { bias: formatNumber(Math.abs(sensor.bias), 3) },
    });
  }

  // --- 8. Disabled sensors (educational note) ---
  const disabledSensors: string[] = [];
  if (!config.sensors.touch) disabledSensors.push('touch');
  if (!config.sensors.chemo) disabledSensors.push('chemo');
  if (!config.sensors.thermo) disabledSensors.push('thermo');
  if (disabledSensors.length > 0) {
    explanations.push({
      key: 'explanation.sensors_disabled',
      params: { sensors: disabledSensors.join(', ') },
    });
  }

  return explanations;
}

/**
 * Generate a single primary explanation line (the most important one).
 * Useful for compact UI displays.
 */
export function generatePrimaryExplanation(ctx: ExplanationContext): Explanation {
  const all = generateExplanations(ctx);
  return all[0] || { key: 'explanation.idle', params: {} };
}
