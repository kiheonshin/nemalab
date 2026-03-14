// ============================================================================
// Nema Lab Simulation Engine — World Generator
// Pure TypeScript, zero browser/DOM/Canvas dependencies
//
// Deterministic world generation: config + seed -> World
// Preserves original app.js generateWorld() logic exactly.
// ============================================================================

import type { SimConfig, World, FoodPatch, Obstacle, TemperatureHotspot } from './types';
import { mulberry32, hashString } from './rng';

/**
 * Generate a deterministic world from a seed string and config.
 *
 * The world seed incorporates obstacle density, food radius, and temperature
 * mode so that changing any of those regenerates a fresh world layout.
 *
 * Algorithm preserved from app.js WormSimulation.generateWorld():
 * 1. Hash seed + world params to create RNG
 * 2. Place food patch with slight random offset
 * 3. Place obstacles avoiding food, start position, and each other
 * 4. Place temperature hotspot
 */
export function generateWorld(config: SimConfig, seed: string): World {
  const cfg = config;
  const rng = mulberry32(
    hashString(
      `${seed}|world|${cfg.world.obstacleDensity}|${cfg.world.foodRadius}|${cfg.world.temperatureMode}`,
    )(),
  );

  // --- Food patch ---
  const food: FoodPatch = {
    x: 72 + (rng() - 0.5) * 8,
    y: 28 + (rng() - 0.5) * 10,
    radius: cfg.world.foodRadius,
    strength: cfg.world.foodStrength,
  };

  // --- Obstacles ---
  const obstacleCount = Math.max(0, Math.round(cfg.world.obstacleDensity * 42));
  const obstacles: Obstacle[] = [];
  let guard = 0;

  while (obstacles.length < obstacleCount && guard < 800) {
    guard += 1;
    const radius = 2.4 + rng() * 4.8;
    const obstacle: Obstacle = {
      x: 12 + rng() * 76,
      y: 12 + rng() * 76,
      r: radius,
    };

    const farEnoughFromFood =
      Math.hypot(obstacle.x - food.x, obstacle.y - food.y) > food.radius + radius + 8;
    const farEnoughFromStart = Math.hypot(obstacle.x - 18, obstacle.y - 72) > radius + 8;
    const overlapsExisting = obstacles.some(
      (item) => Math.hypot(item.x - obstacle.x, item.y - obstacle.y) < item.r + obstacle.r + 3.4,
    );

    if (farEnoughFromFood && farEnoughFromStart && !overlapsExisting) {
      obstacles.push(obstacle);
    }
  }

  // --- Temperature hotspot ---
  const temperatureHotspot: TemperatureHotspot = {
    x: 36 + rng() * 28,
    y: 24 + rng() * 42,
  };

  return { food, obstacles, temperatureHotspot };
}
