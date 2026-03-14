// ============================================================================
// Nema Lab Simulation Engine — Sensor System
// Pure TypeScript, zero browser/DOM/Canvas dependencies
//
// Handles: sensor sample point computation, food/temperature sampling,
// collision detection. All logic preserved from original app.js.
// ============================================================================

import type {
  Point,
  SimConfig,
  World,
  WormState,
  SamplePoints,
  CollisionResult,
} from './types';
import { clamp } from './math';
import {
  SENSOR_ANGLE_OFFSET,
  FRONT_SENSOR_EXTRA,
  WALL_MARGIN,
  WORLD_SIZE,
  OBSTACLE_COLLISION_PAD,
} from './constants';

// ---------------------------------------------------------------------------
// Sample Point Computation
// ---------------------------------------------------------------------------

/**
 * Compute the three sensor sample points (front, left, right) relative to
 * the worm's current position and heading.
 *
 * Preserved from app.js WormSimulation.computeSamplePoints().
 */
export function computeSamplePoints(worm: WormState, config: SimConfig): SamplePoints {
  const sampleDistance = config.sensors.sampleDistance;
  const { x, y, heading } = worm;
  const leftAngle = heading - SENSOR_ANGLE_OFFSET;
  const rightAngle = heading + SENSOR_ANGLE_OFFSET;

  return {
    frontPoint: {
      x: x + Math.cos(heading) * (sampleDistance + FRONT_SENSOR_EXTRA),
      y: y + Math.sin(heading) * (sampleDistance + FRONT_SENSOR_EXTRA),
    },
    leftPoint: {
      x: x + Math.cos(leftAngle) * sampleDistance,
      y: y + Math.sin(leftAngle) * sampleDistance,
    },
    rightPoint: {
      x: x + Math.cos(rightAngle) * sampleDistance,
      y: y + Math.sin(rightAngle) * sampleDistance,
    },
  };
}

// ---------------------------------------------------------------------------
// Food (Chemosensory) Sampling
// ---------------------------------------------------------------------------

/**
 * Sample the food concentration (Gaussian field) at a given point.
 *
 * Preserved from app.js WormSimulation.sampleFood().
 */
export function sampleFood(point: Point, world: World): number {
  const { food } = world;
  const dx = point.x - food.x;
  const dy = point.y - food.y;
  const sigma = food.radius * 1.55;
  return food.strength * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

// ---------------------------------------------------------------------------
// Temperature Sampling
// ---------------------------------------------------------------------------

/**
 * Sample the temperature field at a given point.
 *
 * Modes:
 * - 'none': returns preferredTemperature (constant)
 * - 'linear': temperature = x / 100 (cold left, hot right)
 * - 'radial': temperature = 1 - distance/62 from hotspot (clamped)
 *
 * Preserved from app.js WormSimulation.sampleTemperature().
 */
export function sampleTemperature(point: Point, config: SimConfig, world: World): number {
  const { temperatureMode, preferredTemperature } = config.world;
  if (temperatureMode === 'none') return preferredTemperature;
  if (temperatureMode === 'linear') return clamp(point.x / WORLD_SIZE, 0, 1);
  // radial
  const hotspot = world.temperatureHotspot;
  const d = Math.hypot(point.x - hotspot.x, point.y - hotspot.y);
  return clamp(1 - d / 62, 0, 1);
}

// ---------------------------------------------------------------------------
// Collision Detection
// ---------------------------------------------------------------------------

/**
 * Detect collision at a given point against walls and obstacles.
 *
 * Preserved from app.js WormSimulation.detectCollision().
 */
export function detectCollision(point: Point, world: World): CollisionResult {
  if (
    point.x < WALL_MARGIN ||
    point.x > WORLD_SIZE - WALL_MARGIN ||
    point.y < WALL_MARGIN ||
    point.y > WORLD_SIZE - WALL_MARGIN
  ) {
    return { hit: true, kind: 'wall' };
  }
  for (const obstacle of world.obstacles) {
    if (
      Math.hypot(point.x - obstacle.x, point.y - obstacle.y) <
      obstacle.r + OBSTACLE_COLLISION_PAD
    ) {
      return { hit: true, kind: 'obstacle' };
    }
  }
  return { hit: false, kind: 'none' };
}
