// ============================================================================
// Nema Lab Simulation Engine — Constants
// Pure TypeScript, zero browser/DOM/Canvas dependencies
// ============================================================================

// Types are inferred from the const objects below

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG = Object.freeze({
  presetName: 'Food Seeking',
  worm: {
    baseSpeed: 15,
    turnSharpness: 1.6,
    reversalDuration: 720,
    segmentCount: 18,
  },
  sensors: {
    touch: true,
    chemo: true,
    thermo: false,
    sampleDistance: 6,
    memory: 950,
    noise: 0.08,
  },
  behavior: {
    turnProbability: 0.055,
    gradientGain: 1.2,
    exploration: 0.18,
    discomfort: 0.35,
  },
  world: {
    obstacleDensity: 0.08,
    foodStrength: 1.1,
    foodRadius: 14,
    temperatureMode: 'none' as const,
    preferredTemperature: 0.5,
  },
  visuals: {
    showTrail: true,
    showChemicalOverlay: true,
    showTemperatureOverlay: false,
    showSensors: false,
    showEventMarkers: true,
    cleanMode: false,
    trailLength: 260,
    overlayOpacity: 0.34,
  },
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESETS = Object.freeze([
  {
    id: 'food-seeking',
    name: 'Food Seeking',
    description: '화학 감각을 켠 기본 preset입니다. 국소 감각만으로도 먹이 방향으로 편향되는 경향을 보여줍니다.',
    tags: ['입문', '화학', '기본값'],
    overrides: {},
  },
  {
    id: 'touch-only',
    name: 'Touch Only',
    description: '촉각만 켠 상태입니다. 장애물 회피는 가능하지만 먹이를 안정적으로 찾기 어렵습니다.',
    tags: ['촉각', '비교용'],
    overrides: {
      presetName: 'Touch Only',
      sensors: { touch: true, chemo: false, thermo: false },
      world: { obstacleDensity: 0.12 },
      visuals: { showChemicalOverlay: false, showTemperatureOverlay: false },
    },
  },
  {
    id: 'chemo-bias',
    name: 'Chemo Bias',
    description: '화학 감각과 gradient gain을 높여, 먹이 패치로 더 빠르게 끌리는 조건입니다.',
    tags: ['화학', '탐색'],
    overrides: {
      presetName: 'Chemo Bias',
      behavior: { gradientGain: 2.1, exploration: 0.1 },
      sensors: { chemo: true, touch: true, thermo: false },
      visuals: { showChemicalOverlay: true },
    },
  },
  {
    id: 'thermal-belt',
    name: 'Thermal Belt',
    description: '온도 기울기와 선호 온도를 함께 사용합니다. 특정 온도 띠를 따라 머무르는 행동을 볼 수 있습니다.',
    tags: ['온도', '온도선호'],
    overrides: {
      presetName: 'Thermal Belt',
      sensors: { thermo: true, chemo: false, touch: true },
      world: { temperatureMode: 'linear', preferredTemperature: 0.62, obstacleDensity: 0.05 },
      visuals: { showChemicalOverlay: false, showTemperatureOverlay: true },
    },
  },
  {
    id: 'blind-rover',
    name: 'Blind Rover',
    description: '감각을 모두 끄고 exploration만으로 움직입니다. 단순 이동이 얼마나 비효율적인지 비교할 수 있습니다.',
    tags: ['무감각', '대조군'],
    overrides: {
      presetName: 'Blind Rover',
      sensors: { touch: false, chemo: false, thermo: false },
      behavior: { gradientGain: 0, exploration: 0.42, turnProbability: 0.08 },
      visuals: { showChemicalOverlay: false, showTemperatureOverlay: false },
    },
  },
  {
    id: 'obstacle-field',
    name: 'Obstacle Field',
    description: '장애물 밀도를 높여 촉각 기반 회피와 회전 이벤트를 집중적으로 관찰할 수 있습니다.',
    tags: ['촉각', '고밀도'],
    overrides: {
      presetName: 'Obstacle Field',
      sensors: { touch: true, chemo: true, thermo: false },
      world: { obstacleDensity: 0.18, foodRadius: 12 },
      behavior: { exploration: 0.22 },
    },
  },
]);

// ---------------------------------------------------------------------------
// Legend (pure data, rendering is renderer's job)
// ---------------------------------------------------------------------------

export interface LegendItem {
  label: string;
  color: string;
}

export const LEGEND_ITEMS: readonly LegendItem[] = Object.freeze([
  { label: 'Cruise', color: '#7de2cf' },
  { label: 'Reverse', color: '#f5c97b' },
  { label: 'Turn', color: '#ff9a9a' },
  { label: 'Food field', color: '#8be9b4' },
  { label: 'Obstacle', color: '#7b879b' },
  { label: 'Temperature field', color: '#9cb8ff' },
]);

// ---------------------------------------------------------------------------
// World Bounds
// ---------------------------------------------------------------------------

/** World coordinate space is 0–100 in both axes. */
export const WORLD_SIZE = 100;
/** Wall collision margin from world edges. */
export const WALL_MARGIN = 2;
/** Obstacle collision padding (radius expansion for collision detection). */
export const OBSTACLE_COLLISION_PAD = 1.2;

// ---------------------------------------------------------------------------
// Physics Constants
// ---------------------------------------------------------------------------

/** Sensor left/right angular offset from heading (radians). */
export const SENSOR_ANGLE_OFFSET = 0.58;
/** Front sensor extends further than side sensors. */
export const FRONT_SENSOR_EXTRA = 2.2;
/** Segment spacing base distance. */
export const SEGMENT_BASE_DISTANCE = 1.2;

// ---------------------------------------------------------------------------
// Event & Trail Limits
// ---------------------------------------------------------------------------

export const MAX_RECENT_EVENTS = 7;
export const MAX_EVENT_MARKERS = 32;
