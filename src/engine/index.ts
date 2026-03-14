// ============================================================================
// Nema Lab Simulation Engine — Barrel Export
// ============================================================================

// --- Types ---
export type {
  Point,
  SimConfig,
  WormConfig,
  SensorConfig,
  BehaviorConfig,
  WorldConfig,
  VisualsConfig,
  FoodPatch,
  Obstacle,
  TemperatureHotspot,
  World,
  WormBehaviorState,
  Segment,
  WormState,
  SensorState,
  SamplePoints,
  CollisionKind,
  CollisionResult,
  RawMetrics,
  Metrics,
  SimEvent,
  SimEventType,
  Snapshot,
  SimState,
  Explanation,
  Preset,
} from './types';

// --- Core simulation class ---
export { WormSimulation } from './WormSimulation';

// --- World generation ---
export { generateWorld } from './WorldGenerator';

// --- Sensor system ---
export {
  computeSamplePoints,
  sampleFood,
  sampleTemperature,
  detectCollision,
} from './SensorSystem';

// --- Behavior system ---
export { stepBehavior, updateBody } from './BehaviorSystem';
export type { StepContext, StepResult } from './BehaviorSystem';

// --- Explanation engine ---
export { generateExplanations, generatePrimaryExplanation } from './ExplanationEngine';
export type { ExplanationContext } from './ExplanationEngine';

// --- RNG ---
export { hashString, mulberry32, randomSeed } from './rng';

// --- Math utilities ---
export { clamp, lerp, formatNumber, formatSigned, timeLabel, deepClone, mergeDeep, getByPath, setByPath, eventColorForType } from './math';

// --- Constants ---
export {
  DEFAULT_CONFIG,
  PRESETS,
  LEGEND_ITEMS,
  WORLD_SIZE,
  WALL_MARGIN,
  OBSTACLE_COLLISION_PAD,
  SENSOR_ANGLE_OFFSET,
  FRONT_SENSOR_EXTRA,
  SEGMENT_BASE_DISTANCE,
  MAX_RECENT_EVENTS,
  MAX_EVENT_MARKERS,
} from './constants';
export type { LegendItem } from './constants';
