// ============================================================================
// Nema Lab Simulation Engine — Type Definitions
// Pure TypeScript, zero browser/DOM/Canvas dependencies
// ============================================================================

// ---------------------------------------------------------------------------
// 2D Primitives
// ---------------------------------------------------------------------------

/** 2D point in world coordinates (0–100 range). */
export interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Simulation Configuration
// ---------------------------------------------------------------------------

export interface WormConfig {
  /** Movement speed in world-units/s (range 5–30, default 15). */
  baseSpeed: number;
  /** Angular velocity multiplier (range 0.4–3.0, default 1.6). */
  turnSharpness: number;
  /** Duration of reversal state in ms (range 200–2000, default 720). */
  reversalDuration: number;
  /** Number of body segments (range 8–32, default 18). */
  segmentCount: number;
}

export interface SensorConfig {
  /** Enable mechanosensory (touch) detection. */
  touch: boolean;
  /** Enable chemosensory (food gradient) detection. */
  chemo: boolean;
  /** Enable thermosensory (temperature gradient) detection. */
  thermo: boolean;
  /** Distance from head to sensor sample points (range 3–12, default 6). */
  sampleDistance: number;
  /** Temporal integration window in ms (range 200–3000, default 950). */
  memory: number;
  /** Gaussian noise amplitude added to sensor readings (range 0–0.5, default 0.08). */
  noise: number;
}

export interface BehaviorConfig {
  /** Base probability of spontaneous turn per frame (range 0–0.2, default 0.055). */
  turnProbability: number;
  /** Multiplier for gradient-following strength (range 0–4, default 1.2). */
  gradientGain: number;
  /** Random walk component strength (range 0–1, default 0.18). */
  exploration: number;
  /** Temperature discomfort threshold (range 0–1, default 0.35). */
  discomfort: number;
}

export interface WorldConfig {
  /** Fraction of arena filled with obstacles (range 0–0.3, default 0.08). */
  obstacleDensity: number;
  /** Gaussian peak amplitude of food patch (range 0.2–3, default 1.1). */
  foodStrength: number;
  /** Radius of food patch in world-units (range 6–28, default 14). */
  foodRadius: number;
  /** Temperature field mode: 'none' | 'linear' | 'radial'. */
  temperatureMode: 'none' | 'linear' | 'radial';
  /** Target temperature the worm prefers (range 0–1, default 0.5). */
  preferredTemperature: number;
}

export interface VisualsConfig {
  /** Show movement trail. */
  showTrail: boolean;
  /** Show food gradient overlay. */
  showChemicalOverlay: boolean;
  /** Show temperature gradient overlay. */
  showTemperatureOverlay: boolean;
  /** Show sensor sample points. */
  showSensors: boolean;
  /** Show event markers on canvas. */
  showEventMarkers: boolean;
  /** Hide grid/borders for clean look. */
  cleanMode: boolean;
  /** Max trail segments retained (range 50–600, default 260). */
  trailLength: number;
  /** Opacity of overlay layers (range 0–1, default 0.34). */
  overlayOpacity: number;
}

/** Full simulation configuration (all groups). */
export interface SimConfig {
  presetName: string;
  worm: WormConfig;
  sensors: SensorConfig;
  behavior: BehaviorConfig;
  world: WorldConfig;
  visuals: VisualsConfig;
}

// ---------------------------------------------------------------------------
// World (generated from config + seed)
// ---------------------------------------------------------------------------

export interface FoodPatch {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export interface TemperatureHotspot {
  x: number;
  y: number;
}

/** Deterministically generated world state. */
export interface World {
  food: FoodPatch;
  obstacles: Obstacle[];
  temperatureHotspot: TemperatureHotspot;
}

// ---------------------------------------------------------------------------
// Worm State
// ---------------------------------------------------------------------------

/** Behavioral state machine states. */
export type WormBehaviorState = 'cruise' | 'reverse' | 'turn';

/** Segment of worm body. */
export interface Segment {
  x: number;
  y: number;
}

/** Full mutable worm state. */
export interface WormState {
  x: number;
  y: number;
  heading: number;
  state: WormBehaviorState;
  stateTimer: number;
  turnDir: 1 | -1;
  lastSpeed: number;
  segments: Segment[];
  trail: Point[];
}

// ---------------------------------------------------------------------------
// Sensor State
// ---------------------------------------------------------------------------

export interface SensorState {
  chemoLeft: number;
  chemoRight: number;
  chemoCenter: number;
  tempCurrent: number;
  tempError: number;
  touchFront: boolean;
  touchLeft: boolean;
  touchRight: boolean;
  /** Combined directional bias from all sensors + randomness. */
  bias: number;
}

// ---------------------------------------------------------------------------
// Sample Points (sensor probe locations)
// ---------------------------------------------------------------------------

export interface SamplePoints {
  frontPoint: Point;
  leftPoint: Point;
  rightPoint: Point;
}

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

export type CollisionKind = 'none' | 'wall' | 'obstacle';

export interface CollisionResult {
  hit: boolean;
  kind: CollisionKind;
}

// ---------------------------------------------------------------------------
// Metrics (accumulated per run)
// ---------------------------------------------------------------------------

export interface RawMetrics {
  elapsed: number;
  distance: number;
  collisions: number;
  turns: number;
  reversals: number;
  foodTime: number;
  firstFoodTime: number | null;
  chemoAccum: number;
  tempErrorAccum: number;
  samples: number;
  eventCount: number;
}

/** Derived metrics exposed to UI. */
export interface Metrics {
  elapsed: number;
  distance: number;
  collisions: number;
  turns: number;
  reversals: number;
  foodTime: number;
  firstFoodTime: number | null;
  avgChemo: number;
  avgTempError: number;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Simulation Events
// ---------------------------------------------------------------------------

export type SimEventType =
  | 'start'
  | 'collision'
  | 'reverse'
  | 'turn'
  | 'resume'
  | 'food'
  | 'food-exit';

export interface SimEvent {
  type: SimEventType;
  title: string;
  time: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Snapshot (full read-only state for UI/renderer)
// ---------------------------------------------------------------------------

export interface Snapshot {
  state: WormBehaviorState;
  position: Point;
  heading: number;
  speed: number;
  sensor: SensorState;
  metrics: Metrics;
  events: SimEvent[];
}

// ---------------------------------------------------------------------------
// Full Simulation State (for serialization / storage)
// ---------------------------------------------------------------------------

export interface SimState {
  config: SimConfig;
  seed: string;
  worm: WormState;
  sensor: SensorState;
  world: World;
  metrics: RawMetrics;
  recentEvents: SimEvent[];
  prevChemo: number;
  wasInsideFood: boolean;
}

// ---------------------------------------------------------------------------
// Explanation (i18n-key based)
// ---------------------------------------------------------------------------

export interface Explanation {
  /** i18n translation key (e.g. 'explanation.cruising_toward_food'). */
  key: string;
  /** Interpolation variables for i18n. */
  params: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

export interface Preset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  overrides: Partial<SimConfig> & {
    sensors?: Partial<SensorConfig>;
    behavior?: Partial<BehaviorConfig>;
    world?: Partial<WorldConfig>;
    visuals?: Partial<VisualsConfig>;
    worm?: Partial<WormConfig>;
  };
}
