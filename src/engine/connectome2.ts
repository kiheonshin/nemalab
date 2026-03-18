import connectomeBDataRaw from '../data/connectomeBData.json';
import type { Snapshot, SimConfig, WormBehaviorState } from './types';
import type { WormSimulation } from './WormSimulation';

export type Connectome2Role =
  | 'sensory'
  | 'sensory-motor'
  | 'interneuron'
  | 'motor'
  | 'pharyngeal'
  | 'can'
  | 'other';

export interface Connectome2Signal {
  key: string;
  label: string;
  value: number;
  polarity?: 'left' | 'right' | 'neutral';
}

export interface Connectome2Pathway {
  id: string;
  source: string;
  target: string;
  flux: number;
  edgeType: 'effective' | 'chemical' | 'electrical';
}

export interface Connectome2Readout {
  forwardScore: number;
  backwardScore: number;
  turnScore: number;
  arousalScore: number;
  predictedState: string;
}

export interface Connectome2Narrative {
  title: string;
  summary: string;
  route: string[];
  dominantDrive:
    | 'chemotaxis'
    | 'thermotaxis'
    | 'touch'
    | 'roaming'
    | 'forward'
    | 'reverse'
    | 'turn';
}

export interface Connectome2NeuronDetail {
  name: string;
  role: Connectome2Role;
  label: string;
  summary: string;
  bodyZone: string;
  side: string;
}

export interface Connectome2NeuronActivity extends Connectome2NeuronDetail {
  activation: number;
  signedActivity: number;
  effectiveInput: number;
}

export interface Connectome2Frame {
  activities: Record<string, number>;
  effectiveInputs: Record<string, number>;
  topNeurons: Connectome2NeuronActivity[];
  highlightedNames: string[];
  pathways: Connectome2Pathway[];
  narrative: Connectome2Narrative;
  readout: Connectome2Readout;
  signals: Connectome2Signal[];
  state: WormBehaviorState;
  foodProximity: number;
  forwardDrive: number;
  reverseDrive: number;
  turnDrive: number;
}

export interface Connectome2LayoutNode {
  name: string;
  xNorm: number;
  zNorm: number;
  role: string;
  bodyZone: string;
  side: string;
}

interface Connectome2Node extends Connectome2LayoutNode {
  x: number;
  y: number;
}

interface Connectome2StructuralEdge {
  source: string;
  target: string;
  weight: number;
  edgeType: 'chemical' | 'electrical';
  sourceRole: string;
  targetRole: string;
}

interface Connectome2PresetEdge {
  source: string;
  target: string;
  weight: number;
}

interface Connectome2Preset {
  stimulusTargets: Array<{
    name: string;
    amp: number;
    sign: number;
  }>;
  effectiveEdges: Connectome2PresetEdge[];
}

interface Connectome2Data {
  nodes: Connectome2Node[];
  chemicalEdges: Connectome2StructuralEdge[];
  gapEdges: Connectome2StructuralEdge[];
  presets: Record<string, Connectome2Preset>;
  groups: Record<string, string[]>;
}

interface IndexedEdge {
  sourceIndex: number;
  targetIndex: number;
  source: string;
  target: string;
  weight: number;
  edgeType: 'effective' | 'chemical' | 'electrical';
}

interface Connectome2Runtime {
  lastElapsed: number;
  lastSeed: string;
  activity: Float32Array;
  effectiveInput: Float32Array;
  displayedPathways: Map<string, Connectome2Pathway>;
  locomotionPhase: number;
  previousHeading: number;
  previousDistance: number;
  previousChemoCenter: number;
  cachedFrame: Connectome2Frame | null;
}

interface Connectome2Features {
  bias: number;
  turnVector: number;
  speedNorm: number;
  foodProximity: number;
  chemoGradient: number;
  chemoDrive: number;
  chemoLeftDrive: number;
  chemoRightDrive: number;
  chemoCenter: number;
  chemoChange: number;
  foodLossDrive: number;
  thermoGradient: number;
  thermoDrive: number;
  thermoLeftDrive: number;
  thermoRightDrive: number;
  touchFront: number;
  touchLeft: number;
  touchRight: number;
  aversiveDrive: number;
  exploratoryDrive: number;
  arousalDrive: number;
  forwardDrive: number;
  reverseDrive: number;
  turnDrive: number;
  bodyCurvature: number;
  waveAmplitude: number;
  locomotionPhase: number;
  collisionPulse: number;
  reversePulse: number;
  turnPulse: number;
  foodEntryPulse: number;
  foodExitPulse: number;
  turnDir: -1 | 1;
}

const connectome2Data = connectomeBDataRaw as Connectome2Data;

const NODES = connectome2Data.nodes;
const CHEMICAL_EDGES = connectome2Data.chemicalEdges;
const GAP_EDGES = connectome2Data.gapEdges;
const PRESETS = connectome2Data.presets;
const GROUPS = connectome2Data.groups;

export const connectome2LayoutNodes: Connectome2LayoutNode[] = NODES.map((node) => ({
  name: node.name,
  xNorm: node.xNorm,
  zNorm: node.zNorm,
  role: node.role,
  bodyZone: node.bodyZone,
  side: node.side,
}));

const NODE_BY_NAME = new Map(NODES.map((node) => [node.name, node]));
const NODE_INDEX_BY_NAME = new Map(NODES.map((node, index) => [node.name, index]));
const OVERLAY_RUNTIME = new WeakMap<WormSimulation, Connectome2Runtime>();

const ROLE_LABELS: Record<Connectome2Role, string> = {
  sensory: 'Sensory neuron',
  'sensory-motor': 'Sensory-motor neuron',
  interneuron: 'Interneuron',
  motor: 'Motor neuron',
  pharyngeal: 'Pharyngeal neuron',
  can: 'CAN support neuron',
  other: 'Other neuron',
};

const ROLE_SUMMARIES: Record<Connectome2Role, string> = {
  sensory: 'Samples external cues and seeds the live connectome overlay.',
  'sensory-motor': 'Sits close to both stimulus sampling and motor execution.',
  interneuron: 'Relays and integrates state-dependent flow across the network.',
  motor: 'Represents downstream posture or locomotor output in the overlay.',
  pharyngeal: 'Belongs to the pharyngeal subnetwork rather than body-wall locomotion.',
  can: 'Retained in the atlas layout as a support neuron outside the main motor loop.',
  other: 'Present in the atlas but not mapped to a more specific role label here.',
};

const CHEMICAL_SOURCE_GAIN: Float32Array = new Float32Array(
  NODES.map((node) =>
    node.role === 'sensory'
      ? 0.18
      : node.role === 'sensory-motor'
        ? 0.16
        : node.role === 'interneuron'
          ? 0.15
          : node.role === 'motor'
            ? 0.11
            : node.role === 'pharyngeal'
              ? 0.06
              : 0.05,
  ),
);

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function lerpValue(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function timeAlpha(dt: number, timeConstant: number) {
  return 1 - Math.exp(-dt / Math.max(0.001, timeConstant));
}

function shortestAngleDelta(delta: number) {
  let wrapped = delta;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function meanPositiveFrom(activity: Float32Array, indices: number[]) {
  if (!indices.length) return 0;
  let total = 0;
  for (const index of indices) {
    total += Math.max(0, activity[index]);
  }
  return total / indices.length;
}

function indicesForNames(names: string[]) {
  const indices: number[] = [];
  for (const name of names) {
    const index = NODE_INDEX_BY_NAME.get(name);
    if (index !== undefined) indices.push(index);
  }
  return indices;
}

function indicesMatching(test: (name: string) => boolean) {
  const indices: number[] = [];
  for (let index = 0; index < NODES.length; index += 1) {
    if (test(NODES[index].name)) indices.push(index);
  }
  return indices;
}

function membershipFor(indices: number[]) {
  const membership = new Uint8Array(NODES.length);
  for (const index of indices) membership[index] = 1;
  return membership;
}

const GROUP_FORWARD_CMD = indicesForNames(GROUPS.forwardCmd ?? []);
const GROUP_BACKWARD_CMD = indicesForNames(GROUPS.backwardCmd ?? []);
const GROUP_TURN = indicesForNames(GROUPS.turnNodes ?? []);
const GROUP_AIY = indicesForNames(GROUPS.aiyNodes ?? []);
const GROUP_AROUSAL = indicesForNames(GROUPS.arousalNodes ?? []);
const GROUP_FORWARD_MOTOR = indicesForNames(GROUPS.forwardMotors ?? []);
const GROUP_BACKWARD_MOTOR = indicesForNames(GROUPS.backwardMotors ?? []);

const GROUP_DB = indicesMatching((name) => /^DB\d+$/.test(name));
const GROUP_VB = indicesMatching((name) => /^VB\d+$/.test(name));
const GROUP_DA = indicesMatching((name) => /^DA\d+$/.test(name));
const GROUP_VA = indicesMatching((name) => /^VA\d+$/.test(name));
const GROUP_DD = indicesMatching((name) => /^DD\d+$/.test(name));
const GROUP_VD = indicesMatching((name) => /^VD\d+$/.test(name));
const GROUP_AS = indicesMatching((name) => /^AS\d+$/.test(name));
const GROUP_HEAD_LEFT = indicesMatching(
  (name) =>
    name.endsWith('L') &&
    (/^SMB/.test(name) || /^SMD/.test(name) || /^RMD/.test(name) || /^RIV/.test(name)),
);
const GROUP_HEAD_RIGHT = indicesMatching(
  (name) =>
    name.endsWith('R') &&
    (/^SMB/.test(name) || /^SMD/.test(name) || /^RMD/.test(name) || /^RIV/.test(name)),
);

const MEMBERS_FORWARD_CMD = membershipFor(GROUP_FORWARD_CMD);
const MEMBERS_BACKWARD_CMD = membershipFor(GROUP_BACKWARD_CMD);
const MEMBERS_TURN = membershipFor(GROUP_TURN);
const MEMBERS_FORWARD_MOTOR = membershipFor(GROUP_FORWARD_MOTOR);
const MEMBERS_BACKWARD_MOTOR = membershipFor(GROUP_BACKWARD_MOTOR);

function roleFor(entry: Connectome2Node): Connectome2Role {
  const role = entry.role as Connectome2Role;
  return role in ROLE_LABELS ? role : 'other';
}

export function describeConnectome2Neuron(name: string): Connectome2NeuronDetail {
  const entry = NODE_BY_NAME.get(name);
  if (!entry) {
    return {
      name,
      role: 'other',
      label: 'Other neuron',
      summary: 'This neuron is not present in the connectome overlay atlas.',
      bodyZone: 'unknown',
      side: 'unknown',
    };
  }

  const role = roleFor(entry);
  return {
    name,
    role,
    label: ROLE_LABELS[role],
    summary: ROLE_SUMMARIES[role],
    bodyZone: entry.bodyZone,
    side: entry.side,
  };
}

function activityColorValue(value: number) {
  const x = clampSigned(value);
  if (x < 0) {
    const t = Math.abs(x);
    const r = Math.round(208 - 96 * t);
    const g = Math.round(214 - 34 * t);
    const b = Math.round(230 + 25 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = x;
  const r = Math.round(210 + 45 * t);
  const g = Math.round(214 - 92 * t);
  const b = Math.round(230 - 102 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function roleBorderColor(role: string) {
  switch (role) {
    case 'sensory':
      return '#52d58a';
    case 'sensory-motor':
      return '#22c1a0';
    case 'interneuron':
      return '#8d87ff';
    case 'motor':
      return '#ffb34f';
    case 'pharyngeal':
      return '#d7a62e';
    case 'can':
      return '#e6e6e6';
    default:
      return '#8aa0c5';
  }
}

export function connectome2ActivityColor(value: number) {
  return activityColorValue(value);
}

export function connectome2RoleColor(role: string) {
  return roleBorderColor(role);
}

function createFocusedAdjacency(
  edges: Connectome2StructuralEdge[],
  edgeType: 'chemical' | 'electrical',
  keepPerSource: number,
) {
  const bySource = new Map<number, IndexedEdge[]>();

  for (const edge of edges) {
    const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
    const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const bucket = bySource.get(sourceIndex) ?? [];
    bucket.push({
      sourceIndex,
      targetIndex,
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      edgeType,
    });
    bySource.set(sourceIndex, bucket);
  }

  const perSource = Array.from({ length: NODES.length }, () => [] as IndexedEdge[]);
  const flat: IndexedEdge[] = [];

  for (const [sourceIndex, bucket] of bySource.entries()) {
    bucket.sort((left, right) => right.weight - left.weight);
    const focused = bucket.slice(0, keepPerSource);
    perSource[sourceIndex] = focused;
    flat.push(...focused);
  }

  return { perSource, flat };
}

function createBundleEffectiveEdges() {
  const aggregate = new Map<string, number>();

  for (const preset of Object.values(PRESETS)) {
    for (const edge of preset.effectiveEdges) {
      const key = `${edge.source}->${edge.target}`;
      aggregate.set(key, (aggregate.get(key) ?? 0) + edge.weight);
    }
  }

  const edges: IndexedEdge[] = [];
  const push = (source: string, target: string, weight: number) => {
    const sourceIndex = NODE_INDEX_BY_NAME.get(source);
    const targetIndex = NODE_INDEX_BY_NAME.get(target);
    if (sourceIndex === undefined || targetIndex === undefined) return;
    edges.push({
      sourceIndex,
      targetIndex,
      source,
      target,
      weight,
      edgeType: 'effective',
    });
  };

  for (const [key, weight] of aggregate.entries()) {
    const [source, target] = key.split('->');
    push(source, target, weight);
  }

  push('ASEL', 'AIYL', 0.32);
  push('ASER', 'AIYR', 0.32);
  push('ASIL', 'AIYL', 0.18);
  push('ASIR', 'AIYR', 0.18);
  push('ADFL', 'AIYL', 0.14);
  push('ADFR', 'AIYR', 0.14);
  push('AIYL', 'AVBL', 0.24);
  push('AIYR', 'AVBR', 0.24);
  push('AIYL', 'PVCL', 0.16);
  push('AIYR', 'PVCR', 0.16);
  push('AIBL', 'RIML', 0.22);
  push('AIBR', 'RIMR', 0.22);
  push('AIZL', 'SMDDL', 0.16);
  push('AIZR', 'SMDDR', 0.16);
  push('RIAL', 'SMBDL', 0.16);
  push('RIAR', 'SMBDR', 0.16);
  push('AVAL', 'DA3', 0.24);
  push('AVAR', 'DA4', 0.24);
  push('AVDL', 'VA3', 0.18);
  push('AVDR', 'VA4', 0.18);
  push('AVEL', 'VA6', 0.14);
  push('AVER', 'VA7', 0.14);
  push('AVBL', 'DB3', 0.22);
  push('AVBR', 'DB4', 0.22);
  push('PVCL', 'VB5', 0.18);
  push('PVCR', 'VB6', 0.18);
  push('RID', 'DB5', 0.12);

  return edges;
}

const FOCUSED_CHEMICAL = createFocusedAdjacency(CHEMICAL_EDGES, 'chemical', 8);
const FOCUSED_GAP = createFocusedAdjacency(GAP_EDGES, 'electrical', 5);
const EFFECTIVE_EDGES = createBundleEffectiveEdges();

function createRuntime(seed: string) {
  return {
    lastElapsed: -1,
    lastSeed: seed,
    activity: new Float32Array(NODES.length),
    effectiveInput: new Float32Array(NODES.length),
    displayedPathways: new Map<string, Connectome2Pathway>(),
    locomotionPhase: 0,
    previousHeading: 0,
    previousDistance: 0,
    previousChemoCenter: 0,
    cachedFrame: null,
  } satisfies Connectome2Runtime;
}

function getRuntime(sim: WormSimulation, snapshot: Snapshot) {
  const seed = sim.getSeed();
  const existing = OVERLAY_RUNTIME.get(sim);
  if (!existing || existing.lastSeed !== seed || snapshot.metrics.elapsed < existing.lastElapsed) {
    const runtime = createRuntime(seed);
    OVERLAY_RUNTIME.set(sim, runtime);
    return runtime;
  }
  return existing;
}

function eventPulse(snapshot: Snapshot, types: string[], decaySeconds: number) {
  let total = 0;
  for (const event of snapshot.events) {
    if (!types.includes(event.type)) continue;
    const age = snapshot.metrics.elapsed - event.time;
    if (age < 0) continue;
    total += Math.exp(-age / decaySeconds);
  }
  return clamp01(total);
}

function computeBodyCurvature(sim: WormSimulation) {
  const segments = sim.getState().worm.segments;
  if (segments.length < 3) return 0;

  const head = segments[0];
  const mid = segments[Math.floor(segments.length / 2)];
  const tail = segments[segments.length - 1];
  const v1x = head.x - mid.x;
  const v1y = head.y - mid.y;
  const v2x = tail.x - mid.x;
  const v2y = tail.y - mid.y;
  const norm = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (norm <= 0.0001) return 0;
  const cross = v1x * v2y - v1y * v2x;
  return clampSigned((cross / norm) * 2.6);
}

function computeFeatures(
  sim: WormSimulation,
  snapshot: Snapshot,
  runtime: Connectome2Runtime,
  dt: number,
) {
  const internal = sim.getState();
  const config: SimConfig = sim.getConfig();
  const samplePoints = sim.getSamplePoints();

  const foodLeft = sim.sampleFood(samplePoints.leftPoint);
  const foodRight = sim.sampleFood(samplePoints.rightPoint);
  const foodCenter = sim.sampleFood(snapshot.position);
  const tempLeft = sim.sampleTemperature(samplePoints.leftPoint);
  const tempRight = sim.sampleTemperature(samplePoints.rightPoint);
  const foodDistance = Math.hypot(
    internal.worm.x - internal.world.food.x,
    internal.worm.y - internal.world.food.y,
  );

  const foodProximity = clamp01(1 - foodDistance / (internal.world.food.radius * 3.3));
  const chemoGradient = clampSigned((foodRight - foodLeft) * 3.2);
  const chemoCenter = snapshot.sensor.chemoCenter;
  const chemoChange =
    runtime.lastElapsed >= 0 ? clampSigned((chemoCenter - runtime.previousChemoCenter) * 4.4) : 0;
  const chemoDrive = clamp01(foodProximity * 0.42 + Math.abs(chemoGradient) * 0.72 + foodCenter * 0.22);
  const chemoLeftDrive = clamp01(foodProximity * 0.3 + Math.max(0, -chemoGradient) * 0.86);
  const chemoRightDrive = clamp01(foodProximity * 0.3 + Math.max(0, chemoGradient) * 0.86);
  const foodLossDrive = clamp01(
    Math.max(0, -chemoChange) * 0.72 +
      eventPulse(snapshot, ['food-exit'], 1.2) * 0.48 +
      (1 - foodProximity) * config.behavior.exploration * 0.38,
  );

  const thermoGradient = clampSigned(
    (Math.abs(config.world.preferredTemperature - tempLeft) -
      Math.abs(config.world.preferredTemperature - tempRight)) *
      2.7,
  );
  const thermoDrive = clamp01(snapshot.sensor.tempError * 1.65 + Math.abs(thermoGradient) * 0.62);
  const thermoLeftDrive = clamp01(snapshot.sensor.tempError * 0.34 + Math.max(0, -thermoGradient) * 0.82);
  const thermoRightDrive = clamp01(snapshot.sensor.tempError * 0.34 + Math.max(0, thermoGradient) * 0.82);

  const touchFront = snapshot.sensor.touchFront ? 1 : 0;
  const touchLeft = snapshot.sensor.touchLeft ? 1 : 0;
  const touchRight = snapshot.sensor.touchRight ? 1 : 0;
  const collisionPulse = eventPulse(snapshot, ['collision'], 0.55);
  const reversePulse = eventPulse(snapshot, ['reverse'], 0.65);
  const turnPulse = eventPulse(snapshot, ['turn'], 0.65);
  const foodEntryPulse = eventPulse(snapshot, ['food'], 1.4);
  const foodExitPulse = eventPulse(snapshot, ['food-exit'], 1.2);

  const aversiveDrive = clamp01(
    touchFront * 0.92 +
      Math.max(touchLeft, touchRight) * 0.54 +
      collisionPulse * 0.44 +
      thermoDrive * 0.2,
  );
  const speedNorm = clamp01(snapshot.speed / Math.max(1, config.worm.baseSpeed * 1.05));
  const bias = clampSigned(snapshot.sensor.bias * 1.9);
  const headingRate =
    runtime.lastElapsed >= 0 ? shortestAngleDelta(snapshot.heading - runtime.previousHeading) / dt : 0;
  const turnVector = clampSigned(
    bias * 0.62 +
      clampSigned(headingRate / 2.8) * 0.34 +
      (snapshot.state === 'turn' ? internal.worm.turnDir * 0.44 : 0),
  );

  const exploratoryDrive = clamp01(
    config.behavior.exploration * 1.8 * (1 - foodProximity * 0.6) * (1 - aversiveDrive * 0.86),
  );
  const arousalDrive = clamp01(exploratoryDrive * 0.6 + speedNorm * 0.26 + foodExitPulse * 0.14);
  const forwardDrive = clamp01(
    0.12 +
      (snapshot.state === 'cruise' ? 0.34 : 0.1) +
      speedNorm * 0.34 +
      chemoDrive * 0.18 +
      foodProximity * 0.14 -
      aversiveDrive * 0.22,
  );
  const reverseDrive = clamp01(
    0.06 +
      (snapshot.state === 'reverse' ? 0.58 : 0) +
      aversiveDrive * 0.44 +
      reversePulse * 0.18,
  );
  const turnDrive = clamp01(
    0.08 +
      (snapshot.state === 'turn' ? 0.52 : 0) +
      Math.abs(turnVector) * 0.22 +
      turnPulse * 0.16 +
      Math.max(chemoDrive, thermoDrive) * 0.12,
  );

  const bodyCurvature = computeBodyCurvature(sim);
  const waveAmplitude = clamp01(Math.abs(bodyCurvature) * 1.5 + speedNorm * 0.42 + turnDrive * 0.15);
  const distanceDelta =
    runtime.lastElapsed >= 0 ? Math.max(0, snapshot.metrics.distance - runtime.previousDistance) : 0;
  const locomotionSign =
    snapshot.state === 'reverse' ? -1 : snapshot.state === 'turn' ? internal.worm.turnDir : 1;
  runtime.locomotionPhase = (runtime.locomotionPhase + distanceDelta * 0.95 * locomotionSign) % (Math.PI * 2);
  if (runtime.locomotionPhase < 0) runtime.locomotionPhase += Math.PI * 2;

  return {
    bias,
    turnVector,
    speedNorm,
    foodProximity,
    chemoGradient,
    chemoDrive,
    chemoLeftDrive,
    chemoRightDrive,
    chemoCenter,
    chemoChange,
    foodLossDrive,
    thermoGradient,
    thermoDrive,
    thermoLeftDrive,
    thermoRightDrive,
    touchFront,
    touchLeft,
    touchRight,
    aversiveDrive,
    exploratoryDrive,
    arousalDrive,
    forwardDrive,
    reverseDrive,
    turnDrive,
    bodyCurvature,
    waveAmplitude,
    locomotionPhase: runtime.locomotionPhase,
    collisionPulse,
    reversePulse,
    turnPulse,
    foodEntryPulse,
    foodExitPulse,
    turnDir: internal.worm.turnDir,
  } satisfies Connectome2Features;
}

function addNeuronDrive(store: Float32Array, name: string, amount: number) {
  const index = NODE_INDEX_BY_NAME.get(name);
  if (index === undefined || !Number.isFinite(amount)) return;
  store[index] += amount;
}

function addGroupDrive(store: Float32Array, indices: number[], amount: number) {
  if (!indices.length || amount === 0) return;
  for (const index of indices) store[index] += amount;
}

function addWaveDrive(
  store: Float32Array,
  indices: number[],
  base: number,
  amplitude: number,
  phase: number,
  spacing: number,
) {
  if (!indices.length) return;
  const span = Math.max(1, indices.length - 1);
  for (let offset = 0; offset < indices.length; offset += 1) {
    const theta = phase - (offset / span) * spacing;
    store[indices[offset]] += base + amplitude * Math.sin(theta);
  }
}

function computeExternalDrive(features: Connectome2Features) {
  const drive = new Float32Array(NODES.length);
  const leftTurn = Math.max(0, -features.turnVector);
  const rightTurn = Math.max(0, features.turnVector);

  addNeuronDrive(
    drive,
    'AWCL',
    -0.32 * features.foodProximity - 0.22 * Math.max(0, features.chemoChange) + 0.22 * features.foodLossDrive,
  );
  addNeuronDrive(
    drive,
    'AWCR',
    -0.32 * features.foodProximity - 0.22 * Math.max(0, features.chemoChange) + 0.22 * features.foodLossDrive,
  );
  addNeuronDrive(drive, 'ASEL', 0.18 * features.chemoDrive + 0.42 * features.chemoLeftDrive);
  addNeuronDrive(drive, 'ASER', 0.18 * features.chemoDrive + 0.42 * features.chemoRightDrive);
  addNeuronDrive(drive, 'ASIL', 0.12 * features.foodProximity + 0.1 * features.chemoLeftDrive);
  addNeuronDrive(drive, 'ASIR', 0.12 * features.foodProximity + 0.1 * features.chemoRightDrive);
  addNeuronDrive(drive, 'ADFL', 0.12 * features.foodEntryPulse + 0.08 * features.chemoLeftDrive);
  addNeuronDrive(drive, 'ADFR', 0.12 * features.foodEntryPulse + 0.08 * features.chemoRightDrive);
  addNeuronDrive(drive, 'ASKL', 0.12 * features.foodLossDrive);
  addNeuronDrive(drive, 'ASKR', 0.12 * features.foodLossDrive);
  addNeuronDrive(drive, 'NSML', 0.14 * features.foodProximity + 0.18 * features.foodEntryPulse);
  addNeuronDrive(drive, 'NSMR', 0.14 * features.foodProximity + 0.18 * features.foodEntryPulse);

  addNeuronDrive(drive, 'AFDL', 0.18 * features.thermoDrive + 0.4 * features.thermoLeftDrive);
  addNeuronDrive(drive, 'AFDR', 0.18 * features.thermoDrive + 0.4 * features.thermoRightDrive);

  addNeuronDrive(
    drive,
    'ALML',
    0.22 * features.touchFront + 0.28 * features.touchLeft + 0.18 * features.collisionPulse,
  );
  addNeuronDrive(
    drive,
    'ALMR',
    0.22 * features.touchFront + 0.28 * features.touchRight + 0.18 * features.collisionPulse,
  );
  addNeuronDrive(drive, 'AVM', 0.34 * features.touchFront + 0.16 * features.collisionPulse);
  addNeuronDrive(drive, 'FLPL', 0.12 * features.touchFront + 0.18 * features.touchLeft);
  addNeuronDrive(drive, 'FLPR', 0.12 * features.touchFront + 0.18 * features.touchRight);
  addNeuronDrive(
    drive,
    'ASHL',
    0.18 * features.touchFront + 0.22 * features.touchLeft + 0.24 * features.collisionPulse,
  );
  addNeuronDrive(
    drive,
    'ASHR',
    0.18 * features.touchFront + 0.22 * features.touchRight + 0.24 * features.collisionPulse,
  );
  addNeuronDrive(drive, 'PVDL', 0.08 * features.touchLeft + 0.06 * Math.max(0, -features.bodyCurvature));
  addNeuronDrive(drive, 'PVDR', 0.08 * features.touchRight + 0.06 * Math.max(0, features.bodyCurvature));

  const roamingSensory = 0.18 * features.exploratoryDrive + 0.14 * features.arousalDrive;
  addNeuronDrive(drive, 'URXL', roamingSensory + 0.06 * leftTurn);
  addNeuronDrive(drive, 'URXR', roamingSensory + 0.06 * rightTurn);
  addNeuronDrive(drive, 'AQR', roamingSensory * 0.72 + 0.08 * features.speedNorm);
  addNeuronDrive(drive, 'PQR', roamingSensory * 0.72 + 0.08 * features.speedNorm);

  addNeuronDrive(
    drive,
    'AIYL',
    0.16 * features.chemoLeftDrive + 0.12 * features.thermoLeftDrive + 0.08 * features.forwardDrive - 0.1 * features.turnDrive,
  );
  addNeuronDrive(
    drive,
    'AIYR',
    0.16 * features.chemoRightDrive + 0.12 * features.thermoRightDrive + 0.08 * features.forwardDrive - 0.1 * features.turnDrive,
  );
  addNeuronDrive(drive, 'AIBL', 0.18 * features.foodLossDrive + 0.16 * features.turnDrive + 0.12 * leftTurn);
  addNeuronDrive(drive, 'AIBR', 0.18 * features.foodLossDrive + 0.16 * features.turnDrive + 0.12 * rightTurn);
  addNeuronDrive(drive, 'AIZL', 0.14 * features.turnDrive + 0.1 * features.thermoLeftDrive + 0.08 * leftTurn);
  addNeuronDrive(drive, 'AIZR', 0.14 * features.turnDrive + 0.1 * features.thermoRightDrive + 0.08 * rightTurn);
  addNeuronDrive(drive, 'RIAL', 0.14 * features.turnDrive + 0.08 * features.thermoLeftDrive);
  addNeuronDrive(drive, 'RIAR', 0.14 * features.turnDrive + 0.08 * features.thermoRightDrive);
  addNeuronDrive(drive, 'RIML', 0.16 * features.turnDrive + 0.12 * features.reverseDrive + 0.08 * leftTurn);
  addNeuronDrive(drive, 'RIMR', 0.16 * features.turnDrive + 0.12 * features.reverseDrive + 0.08 * rightTurn);
  addNeuronDrive(drive, 'DVA', 0.18 * features.waveAmplitude + 0.08 * features.speedNorm);
  addNeuronDrive(drive, 'RID', 0.22 * features.forwardDrive + 0.08 * features.speedNorm);

  addNeuronDrive(drive, 'AVBL', 0.24 * features.forwardDrive + 0.06 * leftTurn + 0.06 * features.arousalDrive);
  addNeuronDrive(drive, 'AVBR', 0.24 * features.forwardDrive + 0.06 * rightTurn + 0.06 * features.arousalDrive);
  addNeuronDrive(drive, 'PVCL', 0.18 * features.forwardDrive + 0.06 * leftTurn);
  addNeuronDrive(drive, 'PVCR', 0.18 * features.forwardDrive + 0.06 * rightTurn);

  addNeuronDrive(drive, 'AVAL', 0.28 * features.reverseDrive + 0.1 * features.collisionPulse + 0.05 * leftTurn);
  addNeuronDrive(drive, 'AVAR', 0.28 * features.reverseDrive + 0.1 * features.collisionPulse + 0.05 * rightTurn);
  addNeuronDrive(drive, 'AVDL', 0.22 * features.reverseDrive + 0.08 * features.collisionPulse);
  addNeuronDrive(drive, 'AVDR', 0.22 * features.reverseDrive + 0.08 * features.collisionPulse);
  addNeuronDrive(drive, 'AVEL', 0.14 * features.reverseDrive + 0.06 * features.reversePulse);
  addNeuronDrive(drive, 'AVER', 0.14 * features.reverseDrive + 0.06 * features.reversePulse);

  const headLeft = 0.18 * leftTurn + 0.12 * Math.max(0, -features.bodyCurvature) + 0.08 * features.turnDir * -1;
  const headRight = 0.18 * rightTurn + 0.12 * Math.max(0, features.bodyCurvature) + 0.08 * features.turnDir;
  addGroupDrive(drive, GROUP_HEAD_LEFT, headLeft);
  addGroupDrive(drive, GROUP_HEAD_RIGHT, headRight);
  addGroupDrive(drive, GROUP_HEAD_LEFT, -0.04 * rightTurn);
  addGroupDrive(drive, GROUP_HEAD_RIGHT, -0.04 * leftTurn);

  addGroupDrive(drive, GROUP_FORWARD_MOTOR, -0.12 * features.reverseDrive);
  addGroupDrive(drive, GROUP_BACKWARD_MOTOR, -0.12 * features.forwardDrive);

  const forwardBase = 0.16 * features.forwardDrive + 0.06 * features.speedNorm;
  const reverseBase = 0.18 * features.reverseDrive + 0.04 * features.reversePulse;
  const waveAmp = 0.12 * features.waveAmplitude;

  addWaveDrive(drive, GROUP_DB, forwardBase, waveAmp, features.locomotionPhase + 0.24, 3.2);
  addWaveDrive(drive, GROUP_VB, forwardBase, waveAmp, features.locomotionPhase + Math.PI + 0.24, 3.2);
  addWaveDrive(drive, GROUP_DA, reverseBase, waveAmp, -features.locomotionPhase + 0.18, 3.2);
  addWaveDrive(drive, GROUP_VA, reverseBase, waveAmp, -features.locomotionPhase + Math.PI + 0.18, 3.2);
  addWaveDrive(
    drive,
    GROUP_DD,
    -0.06 * features.forwardDrive - 0.02 * features.reverseDrive,
    0.07 * features.waveAmplitude,
    features.locomotionPhase,
    3.1,
  );
  addWaveDrive(
    drive,
    GROUP_VD,
    -0.06 * features.forwardDrive - 0.02 * features.reverseDrive,
    0.07 * features.waveAmplitude,
    features.locomotionPhase + Math.PI,
    3.1,
  );
  addWaveDrive(
    drive,
    GROUP_AS,
    0.07 * features.forwardDrive + 0.04 * features.turnDrive,
    0.05 * features.waveAmplitude,
    features.locomotionPhase + 0.6,
    2.9,
  );

  return drive;
}

function solveNetwork(
  runtime: Connectome2Runtime,
  externalDrive: Float32Array,
  dt: number,
) {
  let activity = runtime.activity.slice();
  let totalInput = new Float32Array(NODES.length);
  const motifGain = 0.34;
  const chemicalGain = 0.17;
  const gapGain = 0.07;
  const iterations = 3;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const motifInput = new Float32Array(NODES.length);
    const chemicalInput = new Float32Array(NODES.length);
    const gapInput = new Float32Array(NODES.length);
    const x = new Float32Array(NODES.length);

    for (let index = 0; index < NODES.length; index += 1) {
      x[index] = clampSigned(activity[index] + externalDrive[index] * 0.35);
    }

    for (const edge of EFFECTIVE_EDGES) {
      motifInput[edge.targetIndex] += edge.weight * Math.tanh(x[edge.sourceIndex]);
    }

    for (let sourceIndex = 0; sourceIndex < FOCUSED_CHEMICAL.perSource.length; sourceIndex += 1) {
      const sourceValue = Math.tanh(x[sourceIndex]) * CHEMICAL_SOURCE_GAIN[sourceIndex];
      if (Math.abs(sourceValue) < 0.002) continue;
      for (const edge of FOCUSED_CHEMICAL.perSource[sourceIndex]) {
        chemicalInput[edge.targetIndex] += edge.weight * sourceValue;
      }
    }

    for (let sourceIndex = 0; sourceIndex < FOCUSED_GAP.perSource.length; sourceIndex += 1) {
      for (const edge of FOCUSED_GAP.perSource[sourceIndex]) {
        gapInput[edge.targetIndex] += edge.weight * (x[sourceIndex] - x[edge.targetIndex]);
      }
    }

    totalInput = new Float32Array(NODES.length);
    const next = new Float32Array(NODES.length);
    const forwardCommand = meanPositiveFrom(x, GROUP_FORWARD_CMD);
    const backwardCommand = meanPositiveFrom(x, GROUP_BACKWARD_CMD);
    const turnLevel = meanPositiveFrom(x, GROUP_TURN);
    const stabilizingAIY = meanPositiveFrom(x, GROUP_AIY);
    const forwardMotors = meanPositiveFrom(x, GROUP_FORWARD_MOTOR);
    const backwardMotors = meanPositiveFrom(x, GROUP_BACKWARD_MOTOR);
    const decay = iteration === iterations - 1 ? 0.8 : 0.74;

    for (let index = 0; index < NODES.length; index += 1) {
      let localInput =
        externalDrive[index] +
        motifGain * Math.tanh(motifInput[index] * 1.22) +
        chemicalGain * Math.tanh(chemicalInput[index] * 2.5) +
        gapGain * gapInput[index];

      if (MEMBERS_FORWARD_CMD[index]) {
        localInput -= backwardCommand * 0.09 + turnLevel * 0.03;
      }
      if (MEMBERS_BACKWARD_CMD[index]) {
        localInput -= forwardCommand * 0.09;
      }
      if (MEMBERS_TURN[index]) {
        localInput -= stabilizingAIY * 0.07;
      }
      if (MEMBERS_FORWARD_MOTOR[index]) {
        localInput -= backwardMotors * 0.05;
      }
      if (MEMBERS_BACKWARD_MOTOR[index]) {
        localInput -= forwardMotors * 0.05;
      }

      totalInput[index] = localInput;
      next[index] = clampSigned(activity[index] * decay + localInput);
    }

    activity = next;
  }

  const riseAlpha = timeAlpha(dt, 0.085);
  const fallAlpha = timeAlpha(dt, 0.15);
  const inputAlpha = timeAlpha(dt, 0.11);

  for (let index = 0; index < NODES.length; index += 1) {
    const previous = runtime.activity[index];
    const target = activity[index];
    const alpha = Math.abs(target) >= Math.abs(previous) ? riseAlpha : fallAlpha;
    runtime.activity[index] = clampSigned(lerpValue(previous, target, alpha));
    runtime.effectiveInput[index] = lerpValue(runtime.effectiveInput[index], totalInput[index], inputAlpha);
  }
}

function computeReadout(activity: Float32Array, features: Connectome2Features) {
  const forwardScore = clamp01(
    meanPositiveFrom(activity, GROUP_FORWARD_CMD) * 0.62 +
      meanPositiveFrom(activity, GROUP_FORWARD_MOTOR) * 0.38,
  );
  const backwardScore = clamp01(
    meanPositiveFrom(activity, GROUP_BACKWARD_CMD) * 0.62 +
      meanPositiveFrom(activity, GROUP_BACKWARD_MOTOR) * 0.38,
  );
  const turnScore = clamp01(
    meanPositiveFrom(activity, GROUP_TURN) +
      meanPositiveFrom(activity, GROUP_HEAD_LEFT) * 0.2 +
      meanPositiveFrom(activity, GROUP_HEAD_RIGHT) * 0.2 -
      meanPositiveFrom(activity, GROUP_AIY) * 0.18,
  );
  const arousalScore = clamp01(
    meanPositiveFrom(activity, GROUP_AROUSAL) * 0.7 + features.arousalDrive * 0.3,
  );

  let predictedState = 'cruise / forward relay';
  if (backwardScore > forwardScore + 0.05 && backwardScore >= turnScore) {
    predictedState = 'reverse / withdrawal';
  } else if (turnScore > forwardScore + 0.03 && turnScore >= backwardScore) {
    predictedState =
      features.turnVector < -0.08
        ? 'turn / left reorientation'
        : features.turnVector > 0.08
          ? 'turn / right reorientation'
          : 'turn / reorientation';
  } else if (arousalScore > 0.3 && features.foodProximity < 0.22) {
    predictedState = 'cruise / roaming';
  }

  return {
    forwardScore,
    backwardScore,
    turnScore,
    arousalScore,
    predictedState,
  } satisfies Connectome2Readout;
}

function routeForSide(left: string[], right: string[], features: Connectome2Features) {
  const leftDrive = features.touchLeft + Math.max(0, -features.turnVector);
  const rightDrive = features.touchRight + Math.max(0, features.turnVector);
  return leftDrive > rightDrive ? left : rightDrive > leftDrive ? right : features.turnDir < 0 ? left : right;
}

function buildNarrative(features: Connectome2Features, readout: Connectome2Readout): Connectome2Narrative {
  if (readout.backwardScore >= Math.max(readout.forwardScore, readout.turnScore) && features.aversiveDrive > 0.22) {
    const route = routeForSide(
      ['ALML', 'AVM', 'AVAL', 'AVDL', 'DA3'],
      ['ALMR', 'AVM', 'AVAR', 'AVDR', 'DA4'],
      features,
    );
    return {
      title: 'Touch-locked withdrawal',
      summary:
        'Live front-contact and reversal evidence are recruiting the mechanosensory escape route into AVA/AVD and the A-class motor pool.',
      route,
      dominantDrive: 'touch',
    };
  }

  if (readout.turnScore >= Math.max(readout.forwardScore, readout.backwardScore) && features.turnDrive > 0.28) {
    const route = routeForSide(
      ['AIBL', 'AIZL', 'RIAL', 'SMBDL', 'RMDDL'],
      ['AIBR', 'AIZR', 'RIAR', 'SMBDR', 'RMDDR'],
      features,
    );
    return {
      title: 'Reorientation burst',
      summary:
        'Current turning dynamics are lifting AIB/AIZ/RIA and head motor ensembles on the side that matches the worm’s live steering bias.',
      route,
      dominantDrive: 'turn',
    };
  }

  if (features.thermoDrive > 0.3 && features.thermoDrive >= features.chemoDrive) {
    const route = routeForSide(
      ['AFDL', 'AIYL', 'AIZL', 'RIAL', 'SMDDL'],
      ['AFDR', 'AIYR', 'AIZR', 'RIAR', 'SMDDR'],
      features,
    );
    return {
      title: 'Thermotaxis correction',
      summary:
        'Temperature error is currently feeding the AFD-led corrective relay, then passing through AIY/AIZ/RIA into head steering output.',
      route,
      dominantDrive: 'thermotaxis',
    };
  }

  if (features.chemoDrive > 0.26 && features.foodProximity > 0.14) {
    const route = routeForSide(
      ['ASEL', 'AIYL', 'AVBL', 'PVCL', 'DB3'],
      ['ASER', 'AIYR', 'AVBR', 'PVCR', 'VB6'],
      features,
    );
    return {
      title: 'Chemotaxis-locked forward run',
      summary:
        'Food-gradient evidence is stabilizing AIY and the forward command pathway, then spilling into the B-class locomotor relay.',
      route,
      dominantDrive: 'chemotaxis',
    };
  }

  if (features.exploratoryDrive > 0.24 && features.foodProximity < 0.22) {
    const route = routeForSide(
      ['URXL', 'RMGL', 'AVBL', 'PVCL', 'DB4'],
      ['URXR', 'RMGR', 'AVBR', 'PVCR', 'VB6'],
      features,
    );
    return {
      title: 'Roaming drive',
      summary:
        'Low immediate cue lock-in is letting the roaming/arousal scaffold stay active through URX, RMG, AVB/PVC, and forward motor output.',
      route,
      dominantDrive: 'roaming',
    };
  }

  if (readout.backwardScore > readout.forwardScore) {
    return {
      title: 'Reverse command relay',
      summary:
        'Backward command neurons remain more active than the forward pool, keeping the live map anchored to withdrawal execution.',
      route: ['AVAL', 'AVDL', 'AVEL', 'DA3', 'VA6'],
      dominantDrive: 'reverse',
    };
  }

  return {
    title: 'Forward motor relay',
    summary:
      'The current run is dominated by cruise-state command flow from AVB/PVC into the forward body-wall motor pool.',
    route: ['AVBL', 'PVCL', 'DB3', 'VB5', 'RID'],
    dominantDrive: 'forward',
  };
}

function buildPathways(
  runtime: Connectome2Runtime,
  dt: number,
  focusNames: string[],
) {
  const focus = new Uint8Array(NODES.length);
  for (const name of focusNames) {
    const index = NODE_INDEX_BY_NAME.get(name);
    if (index !== undefined) focus[index] = 1;
  }

  const rawPathways = new Map<string, Connectome2Pathway>();

  for (const edge of EFFECTIVE_EDGES) {
    const sourceActivity = runtime.activity[edge.sourceIndex];
    const flux = edge.weight * Math.tanh(sourceActivity);
    if (Math.abs(flux) < 0.034) continue;
    if (!focus[edge.sourceIndex] && !focus[edge.targetIndex] && Math.abs(flux) < 0.06) continue;
    rawPathways.set(`${edge.edgeType}-${edge.source}-${edge.target}`, {
      id: `${edge.edgeType}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      flux,
      edgeType: 'effective',
    });
  }

  for (const edge of FOCUSED_CHEMICAL.flat) {
    const flux = edge.weight * Math.tanh(runtime.activity[edge.sourceIndex]) * 0.58;
    if (Math.abs(flux) < 0.022) continue;
    if (!focus[edge.sourceIndex] && !focus[edge.targetIndex] && Math.abs(flux) < 0.044) continue;
    rawPathways.set(`${edge.edgeType}-${edge.source}-${edge.target}`, {
      id: `${edge.edgeType}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      flux,
      edgeType: 'chemical',
    });
  }

  for (const edge of FOCUSED_GAP.flat) {
    const flux = edge.weight * (runtime.activity[edge.sourceIndex] - runtime.activity[edge.targetIndex]) * 0.76;
    if (Math.abs(flux) < 0.018) continue;
    if (!focus[edge.sourceIndex] && !focus[edge.targetIndex] && Math.abs(flux) < 0.036) continue;
    rawPathways.set(`${edge.edgeType}-${edge.source}-${edge.target}`, {
      id: `${edge.edgeType}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      flux,
      edgeType: 'electrical',
    });
  }

  const nextDisplayed = new Map<string, Connectome2Pathway>();
  const riseAlpha = timeAlpha(dt, 0.08);
  const fallAlpha = timeAlpha(dt, 0.24);
  const candidateIds = new Set<string>([
    ...Array.from(runtime.displayedPathways.keys()),
    ...Array.from(rawPathways.keys()),
  ]);

  for (const id of candidateIds) {
    const raw = rawPathways.get(id);
    const previous = runtime.displayedPathways.get(id);

    if (raw) {
      const previousFlux = previous?.flux ?? 0;
      const alpha = Math.abs(raw.flux) >= Math.abs(previousFlux) ? riseAlpha : fallAlpha;
      nextDisplayed.set(id, {
        ...raw,
        flux: lerpValue(previousFlux, raw.flux, alpha),
      });
      continue;
    }

    if (previous) {
      const decayedFlux = previous.flux * (1 - fallAlpha * 0.9);
      if (Math.abs(decayedFlux) > 0.012) {
        nextDisplayed.set(id, { ...previous, flux: decayedFlux });
      }
    }
  }

  runtime.displayedPathways = nextDisplayed;

  const visible = Array.from(nextDisplayed.values()).filter((pathway) => {
    const magnitude = Math.abs(pathway.flux);
    if (pathway.edgeType === 'effective') return magnitude >= 0.028;
    if (pathway.edgeType === 'chemical') return magnitude >= 0.02;
    return magnitude >= 0.016;
  });

  visible.sort((left, right) => Math.abs(right.flux) - Math.abs(left.flux));
  return visible.slice(0, 38);
}

function buildSignals(
  features: Connectome2Features,
  readout: Connectome2Readout,
) {
  return [
    {
      key: 'chemo',
      label: 'Chemical gradient',
      value: features.chemoDrive,
      polarity:
        features.chemoGradient > 0.08
          ? 'right'
          : features.chemoGradient < -0.08
            ? 'left'
            : 'neutral',
    },
    {
      key: 'thermo',
      label: 'Thermal error',
      value: features.thermoDrive,
      polarity:
        features.thermoGradient > 0.08
          ? 'right'
          : features.thermoGradient < -0.08
            ? 'left'
            : 'neutral',
    },
    {
      key: 'touch',
      label: 'Mechanosensory alert',
      value: features.aversiveDrive,
      polarity:
        features.touchLeft > features.touchRight
          ? 'left'
          : features.touchRight > features.touchLeft
            ? 'right'
            : 'neutral',
    },
    {
      key: 'food',
      label: 'Food proximity',
      value: features.foodProximity,
    },
    {
      key: 'forward',
      label: 'Forward drive',
      value: clamp01(Math.max(features.forwardDrive, readout.forwardScore)),
    },
    {
      key: 'turn',
      label: 'Turn drive',
      value: clamp01(Math.max(features.turnDrive, readout.turnScore)),
      polarity:
        features.turnVector > 0.08
          ? 'right'
          : features.turnVector < -0.08
            ? 'left'
            : 'neutral',
    },
    {
      key: 'reverse',
      label: 'Reverse drive',
      value: clamp01(Math.max(features.reverseDrive, readout.backwardScore)),
    },
  ] satisfies Connectome2Signal[];
}

export function buildConnectome2Frame(sim: WormSimulation, snapshot: Snapshot): Connectome2Frame {
  const runtime = getRuntime(sim, snapshot);
  if (runtime.cachedFrame && Math.abs(runtime.lastElapsed - snapshot.metrics.elapsed) < 1e-6) {
    return runtime.cachedFrame;
  }

  const dt =
    runtime.lastElapsed >= 0
      ? Math.max(1 / 120, Math.min(0.18, snapshot.metrics.elapsed - runtime.lastElapsed))
      : 1 / 60;

  const features = computeFeatures(sim, snapshot, runtime, dt);
  const externalDrive = computeExternalDrive(features);
  solveNetwork(runtime, externalDrive, dt);
  const readout = computeReadout(runtime.activity, features);
  const narrative = buildNarrative(features, readout);

  const activities: Record<string, number> = {};
  const effectiveInputs: Record<string, number> = {};
  const topNeurons = NODES.map((node, index) => {
    const detail = describeConnectome2Neuron(node.name);
    const signedActivity = runtime.activity[index];
    const effectiveInput = runtime.effectiveInput[index];
    activities[node.name] = signedActivity;
    effectiveInputs[node.name] = effectiveInput;
    return {
      ...detail,
      activation: Math.abs(signedActivity) + Math.abs(effectiveInput) * 0.18,
      signedActivity,
      effectiveInput,
    } satisfies Connectome2NeuronActivity;
  })
    .sort((left, right) => right.activation - left.activation)
    .slice(0, 14);

  const focusNames = Array.from(
    new Set([
      ...narrative.route,
      ...topNeurons.slice(0, 10).map((neuron) => neuron.name),
    ]),
  );
  const pathways = buildPathways(runtime, dt, focusNames);

  const highlightedNames = Array.from(
    new Set([
      ...focusNames,
      ...pathways.slice(0, 18).flatMap((pathway) => [pathway.source, pathway.target]),
    ]),
  );

  const frame = {
    activities,
    effectiveInputs,
    topNeurons,
    highlightedNames,
    pathways,
    narrative,
    readout,
    signals: buildSignals(features, readout),
    state: snapshot.state,
    foodProximity: features.foodProximity,
    forwardDrive: clamp01(Math.max(features.forwardDrive, readout.forwardScore)),
    reverseDrive: clamp01(Math.max(features.reverseDrive, readout.backwardScore)),
    turnDrive: clamp01(Math.max(features.turnDrive, readout.turnScore)),
  } satisfies Connectome2Frame;

  runtime.lastElapsed = snapshot.metrics.elapsed;
  runtime.previousHeading = snapshot.heading;
  runtime.previousDistance = snapshot.metrics.distance;
  runtime.previousChemoCenter = snapshot.sensor.chemoCenter;
  runtime.cachedFrame = frame;
  return frame;
}
