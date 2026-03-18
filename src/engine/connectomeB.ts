import connectomeBDataRaw from '../data/connectomeBData.json';
import type { Snapshot, SimConfig, WormBehaviorState } from './types';
import type { WormSimulation } from './WormSimulation';

export type ConnectomeBRole =
  | 'sensory'
  | 'sensory-motor'
  | 'interneuron'
  | 'motor'
  | 'pharyngeal'
  | 'can'
  | 'other';

export interface ConnectomeBSignal {
  key: string;
  label: string;
  value: number;
  polarity?: 'left' | 'right' | 'neutral';
}

export interface ConnectomeBPathway {
  id: string;
  source: string;
  target: string;
  flux: number;
  edgeType: 'effective' | 'chemical' | 'electrical';
}

export interface ConnectomeBNarrative {
  title: string;
  summary: string;
  route: string[];
  dominantDrive: 'chemo' | 'thermo' | 'touch' | 'exploration' | 'forward' | 'reverse';
  presetKey:
    | 'warm_pulse_afd'
    | 'odor_on_awc'
    | 'anterior_touch'
    | 'posterior_touch'
    | 'noxious_ash'
    | 'oxygen_upshift';
}

export interface ConnectomeBNeuronDetail {
  name: string;
  role: ConnectomeBRole;
  label: string;
  summary: string;
  bodyZone: string;
  side: string;
}

export interface ConnectomeBNeuronActivity extends ConnectomeBNeuronDetail {
  activation: number;
  signedActivity: number;
  effectiveInput: number;
}

export interface ConnectomeBFrame {
  activities: Record<string, number>;
  effectiveInputs: Record<string, number>;
  topNeurons: ConnectomeBNeuronActivity[];
  highlightedNames: string[];
  pathways: ConnectomeBPathway[];
  narrative: ConnectomeBNarrative;
  signals: ConnectomeBSignal[];
  state: WormBehaviorState;
  foodProximity: number;
  forwardDrive: number;
  reverseDrive: number;
  turnDrive: number;
}

type PresetKey = ConnectomeBNarrative['presetKey'];

interface ConnectomeBNode {
  name: string;
  x: number;
  y: number;
  z: number;
  xNorm: number;
  yNorm: number;
  zNorm: number;
  role: string;
  bodyZone: string;
  side: string;
}

interface ConnectomeBStructuralEdge {
  source: string;
  target: string;
  weight: number;
  edgeType: 'chemical' | 'electrical';
  sourceRole: string;
  targetRole: string;
  sourceZone: string;
  targetZone: string;
}

interface ConnectomeBPresetTarget {
  name: string;
  amp: number;
  sign: number;
}

interface ConnectomeBPresetEdge {
  source: string;
  target: string;
  weight: number;
}

interface ConnectomeBPreset {
  label: string;
  category: string;
  summary: string;
  modelingNote: string;
  expectedEffect: string;
  stimulusTargets: ConnectomeBPresetTarget[];
  baseline: Record<string, number>;
  effectiveEdges: ConnectomeBPresetEdge[];
  route: string[];
}

interface ConnectomeBData {
  nodes: ConnectomeBNode[];
  chemicalEdges: ConnectomeBStructuralEdge[];
  gapEdges: ConnectomeBStructuralEdge[];
  presets: Record<string, ConnectomeBPreset>;
  groups: Record<string, string[]>;
}

interface BlendedConnectomeBModel {
  weights: Record<PresetKey, number>;
  baseline: Record<string, number>;
  stimulusTargets: ConnectomeBPresetTarget[];
  effectiveEdges: ConnectomeBPresetEdge[];
}

interface ConnectomeBOverlayRuntime {
  lastElapsed: number;
  lastSeed: string;
  smoothedActivity: Float32Array;
  smoothedInput: Float32Array;
  smoothedPresetWeights: Record<PresetKey, number>;
  displayedPathways: Map<string, ConnectomeBPathway>;
  dominantPreset: PresetKey;
  cachedFrame: ConnectomeBFrame | null;
}

const connectomeBData = connectomeBDataRaw as ConnectomeBData;

const NODES = connectomeBData.nodes;
const NODE_BY_NAME = new Map(NODES.map((node) => [node.name, node]));
const NODE_INDEX_BY_NAME = new Map(NODES.map((node, index) => [node.name, index]));
const CHEMICAL_EDGES = connectomeBData.chemicalEdges;
const GAP_EDGES = connectomeBData.gapEdges;
const PRESETS = connectomeBData.presets as Record<PresetKey, ConnectomeBPreset>;
const GROUPS = connectomeBData.groups;
const PRESET_KEYS: PresetKey[] = [
  'warm_pulse_afd',
  'odor_on_awc',
  'anterior_touch',
  'posterior_touch',
  'noxious_ash',
  'oxygen_upshift',
];
const OVERLAY_RUNTIME = new WeakMap<WormSimulation, ConnectomeBOverlayRuntime>();

const CHEMICAL_ADJ = NODES.map(() => [] as Array<{ targetIndex: number; weight: number }>);
const GAP_ADJ = NODES.map(() => [] as Array<{ targetIndex: number; weight: number }>);

for (const edge of CHEMICAL_EDGES) {
  const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
  const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
  if (sourceIndex === undefined || targetIndex === undefined) continue;
  CHEMICAL_ADJ[sourceIndex].push({ targetIndex, weight: edge.weight });
}

for (const edge of GAP_EDGES) {
  const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
  const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
  if (sourceIndex === undefined || targetIndex === undefined) continue;
  GAP_ADJ[sourceIndex].push({ targetIndex, weight: edge.weight });
}

const ROLE_LABELS: Record<ConnectomeBRole, string> = {
  sensory: 'Sensory neuron',
  'sensory-motor': 'Sensory-motor neuron',
  interneuron: 'Interneuron',
  motor: 'Motor neuron',
  pharyngeal: 'Pharyngeal neuron',
  can: 'CAN support neuron',
  other: 'Other neuron',
};

const ROLE_SUMMARIES: Record<ConnectomeBRole, string> = {
  sensory: 'Collects external cues and injects them into the connectome overlay.',
  'sensory-motor': 'Sits close to both sensing and motor execution in the overlay scaffold.',
  interneuron: 'Relays and integrates signal flow between sensory and motor pools.',
  motor: 'Represents downstream output toward posture or locomotor execution.',
  pharyngeal: 'Belongs to the pharyngeal network rather than the locomotor body wall system.',
  can: 'Represents a non-standard support neuron retained in the 302 atlas layout.',
  other: 'Participates in the atlas but is not mapped to a stronger functional label yet.',
};

const PRESET_ROUTES: Record<
  PresetKey,
  { left: string[]; right: string[]; neutral?: string[] }
> = {
  warm_pulse_afd: {
    left: ['AFDL', 'AIYL', 'AIZL', 'RIAL', 'SMDDL'],
    right: ['AFDR', 'AIYR', 'AIZR', 'RIAR', 'SMDDR'],
  },
  odor_on_awc: {
    left: ['AWCL', 'AIYL', 'AIBL', 'AVAL', 'DB3'],
    right: ['AWCR', 'AIYR', 'AIBR', 'AVAR', 'VB5'],
  },
  anterior_touch: {
    left: ['ALML', 'AVM', 'AVAL', 'AVDL', 'DA3'],
    right: ['ALMR', 'AVM', 'AVAR', 'AVDR', 'DA4'],
  },
  posterior_touch: {
    left: ['PLML', 'AVBL', 'PVCL', 'DB3', 'VB5'],
    right: ['PLMR', 'AVBR', 'PVCR', 'DB4', 'VB6'],
  },
  noxious_ash: {
    left: ['ASHL', 'AVAL', 'AIBL', 'RIML', 'SMBDL'],
    right: ['ASHR', 'AVAR', 'AIBR', 'RIMR', 'SMBDR'],
  },
  oxygen_upshift: {
    left: ['URXL', 'RMGL', 'AVBL', 'PVCL', 'DB4'],
    right: ['URXR', 'RMGR', 'AVBR', 'PVCR', 'VB6'],
    neutral: ['URXL', 'URXR', 'RMGL', 'RMGR', 'AVBL', 'AVBR'],
  },
};

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

function createPresetWeightRecord(initial = 0): Record<PresetKey, number> {
  return {
    warm_pulse_afd: initial,
    odor_on_awc: initial,
    anterior_touch: initial,
    posterior_touch: initial,
    noxious_ash: initial,
    oxygen_upshift: initial,
  };
}

function normalizePresetWeights(weights: Record<PresetKey, number>) {
  let total = 0;
  for (const key of PRESET_KEYS) total += Math.max(0, weights[key]);
  if (total <= 0) {
    const fallback = 1 / PRESET_KEYS.length;
    for (const key of PRESET_KEYS) weights[key] = fallback;
    return weights;
  }
  for (const key of PRESET_KEYS) {
    weights[key] = Math.max(0, weights[key]) / total;
  }
  return weights;
}

function createOverlayRuntime(seed: string): ConnectomeBOverlayRuntime {
  return {
    lastElapsed: -1,
    lastSeed: seed,
    smoothedActivity: new Float32Array(NODES.length),
    smoothedInput: new Float32Array(NODES.length),
    smoothedPresetWeights: createPresetWeightRecord(1 / PRESET_KEYS.length),
    displayedPathways: new Map(),
    dominantPreset: 'oxygen_upshift',
    cachedFrame: null,
  };
}

function getOverlayRuntime(sim: WormSimulation, snapshot: Snapshot) {
  const seed = sim.getSeed();
  const existing = OVERLAY_RUNTIME.get(sim);
  if (!existing || existing.lastSeed !== seed || snapshot.metrics.elapsed < existing.lastElapsed) {
    const runtime = createOverlayRuntime(seed);
    OVERLAY_RUNTIME.set(sim, runtime);
    return runtime;
  }
  return existing;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function positiveMean(values: number[]) {
  return mean(values.map((value) => Math.max(0, value)));
}

function groupValues(activity: Float32Array, groupName: keyof typeof GROUPS) {
  const names = GROUPS[groupName] ?? [];
  return names
    .map((name) => {
      const index = NODE_INDEX_BY_NAME.get(name);
      return index === undefined ? 0 : activity[index];
    })
    .filter((value) => Number.isFinite(value));
}

function groupScore(activity: Float32Array, groupName: keyof typeof GROUPS) {
  return positiveMean(groupValues(activity, groupName));
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

export function connectomeBActivityColor(value: number) {
  return activityColorValue(value);
}

export function connectomeBRoleColor(role: string) {
  return roleBorderColor(role);
}

export function describeConnectomeBNeuron(name: string): ConnectomeBNeuronDetail {
  const entry = NODE_BY_NAME.get(name);
  if (!entry) {
    return {
      name,
      role: 'other',
      label: ROLE_LABELS.other,
      summary: ROLE_SUMMARIES.other,
      bodyZone: 'unknown',
      side: 'unknown',
    };
  }

  const role = (entry.role as ConnectomeBRole) in ROLE_LABELS ? (entry.role as ConnectomeBRole) : 'other';

  return {
    name,
    role,
    label: ROLE_LABELS[role],
    summary: `${ROLE_SUMMARIES[role]} Bundle role: ${entry.role}.`,
    bodyZone: entry.bodyZone,
    side: entry.side,
  };
}

function computeStimulusFeatures(sim: WormSimulation, snapshot: Snapshot) {
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

  const foodProximity = clamp01(1 - foodDistance / (internal.world.food.radius * 3.6));
  const chemoGradient = clampSigned((foodRight - foodLeft) * 2.8);
  const chemoSalience = clamp01(Math.abs(chemoGradient) * 0.8 + foodCenter * 0.28);
  const thermoGradient = clampSigned(
    (Math.abs(config.world.preferredTemperature - tempLeft) -
      Math.abs(config.world.preferredTemperature - tempRight)) *
      2.4,
  );
  const thermoSalience = clamp01(snapshot.sensor.tempError * 1.8 + Math.abs(thermoGradient) * 0.55);
  const touchFront = snapshot.sensor.touchFront ? 1 : 0;
  const touchLeft = snapshot.sensor.touchLeft ? 1 : 0;
  const touchRight = snapshot.sensor.touchRight ? 1 : 0;
  const touchSalience = Math.max(touchFront, touchLeft, touchRight);
  const bias = clampSigned(snapshot.sensor.bias * 1.75);
  const appetitiveDrive = clamp01(foodProximity * 0.62 + chemoSalience * 0.8);
  const aversiveDrive = clamp01(touchFront * 0.96 + touchSalience * 0.7 + thermoSalience * 0.34);
  const explorationDrive = clamp01(
    config.behavior.exploration * 1.9 * (1 - appetitiveDrive * 0.65) * (1 - touchSalience * 0.75),
  );
  const forwardDrive = clamp01(
    (snapshot.state === 'cruise' ? 0.4 : 0.18) + appetitiveDrive * 0.46 + config.behavior.gradientGain * 0.05,
  );
  const reverseDrive = clamp01((snapshot.state === 'reverse' ? 0.74 : 0.12) + aversiveDrive * 0.78);
  const turnDrive = clamp01(
    (snapshot.state === 'turn' ? 0.76 : 0.18) + Math.abs(bias) * 0.48 + explorationDrive * 0.24,
  );

  return {
    bias,
    foodProximity,
    chemoGradient,
    chemoSalience,
    thermoGradient,
    thermoSalience,
    touchFront,
    touchLeft,
    touchRight,
    touchSalience,
    appetitiveDrive,
    aversiveDrive,
    explorationDrive,
    forwardDrive,
    reverseDrive,
    turnDrive,
  };
}

function computePresetWeights(features: ReturnType<typeof computeStimulusFeatures>, state: WormBehaviorState) {
  const weights = createPresetWeightRecord();

  weights.anterior_touch =
    0.04 +
    features.touchSalience * 2.1 +
    Math.max(0, features.reverseDrive - 0.25) * 0.5 +
    (state === 'reverse' ? 0.12 : 0);

  weights.noxious_ash =
    0.06 +
    features.aversiveDrive * 1.6 +
    features.reverseDrive * 0.82 +
    Math.abs(features.bias) * 0.16 +
    (state === 'reverse' ? 0.26 : 0);

  weights.warm_pulse_afd =
    0.04 + features.thermoSalience * 1.55 + Math.abs(features.thermoGradient) * 0.34;

  weights.odor_on_awc =
    0.08 +
    features.chemoSalience * 1.48 +
    features.foodProximity * 0.76 +
    Math.abs(features.chemoGradient) * 0.22 +
    (state === 'cruise' ? 0.08 : 0);

  weights.posterior_touch =
    0.05 +
    clamp01(features.forwardDrive * (1 - features.aversiveDrive * 0.7) * (1 - features.chemoSalience * 0.36)) *
      1.22;

  weights.oxygen_upshift =
    0.08 +
    features.explorationDrive * 1.34 +
    clamp01(1 - Math.max(features.chemoSalience, features.thermoSalience, features.aversiveDrive)) * 0.42;

  return normalizePresetWeights(weights);
}

function smoothPresetWeights(
  runtime: ConnectomeBOverlayRuntime,
  rawWeights: Record<PresetKey, number>,
  dt: number,
) {
  const alpha = timeAlpha(dt, 0.18);
  const smoothed = createPresetWeightRecord();

  for (const key of PRESET_KEYS) {
    smoothed[key] = lerpValue(runtime.smoothedPresetWeights[key], rawWeights[key], alpha);
  }

  runtime.smoothedPresetWeights = normalizePresetWeights(smoothed);
  return runtime.smoothedPresetWeights;
}

function resolveDominantPreset(weights: Record<PresetKey, number>, previous: PresetKey) {
  let dominant = previous;
  let dominantWeight = weights[previous];

  for (const key of PRESET_KEYS) {
    if (weights[key] > dominantWeight) {
      dominant = key;
      dominantWeight = weights[key];
    }
  }

  if (previous !== dominant && weights[previous] >= dominantWeight - 0.065) {
    return previous;
  }

  return dominant;
}

function resolveRoute(
  presetKey: ConnectomeBNarrative['presetKey'],
  bias: number,
  sideHint: 'left' | 'right' | 'neutral',
) {
  const presetRoute = PRESET_ROUTES[presetKey];
  if (sideHint === 'neutral' && presetRoute.neutral) return presetRoute.neutral;
  if (sideHint === 'left') return presetRoute.left;
  if (sideHint === 'right') return presetRoute.right;
  return bias >= 0 ? presetRoute.right : presetRoute.left;
}

function buildNarrative(
  presetKey: PresetKey,
  features: ReturnType<typeof computeStimulusFeatures>,
) {
  const sideHint =
    features.touchLeft > features.touchRight
      ? 'left'
      : features.touchRight > features.touchLeft
        ? 'right'
        : Math.abs(features.bias) < 0.08
          ? 'neutral'
          : features.bias < 0
            ? 'left'
            : 'right';

  switch (presetKey) {
    case 'anterior_touch':
      return {
        title: 'Bundle touch-reversal overlay',
        summary:
          'Anterior touch channels from the bundle are routed into the backward command pool, emphasizing AVA/AVD/AVE-biased withdrawal flow.',
        route: resolveRoute(presetKey, features.bias, sideHint),
        dominantDrive: 'touch' as const,
        presetKey,
      };
    case 'posterior_touch':
      return {
        title: 'Bundle forward-initiation overlay',
        summary:
          'Forward-biased relay is projected through the PLM-inspired command pathway, highlighting AVB/PVC recruitment into B-type motor output.',
        route: resolveRoute(presetKey, features.bias, sideHint),
        dominantDrive: 'forward' as const,
        presetKey,
      };
    case 'warm_pulse_afd':
      return {
        title: 'Bundle thermotaxis overlay',
        summary:
          'Thermal salience is mapped through the AFD-centered scaffold, biasing AIY/AIZ integration and head steering correction.',
        route: resolveRoute(presetKey, features.bias, sideHint),
        dominantDrive: 'thermo' as const,
        presetKey,
      };
    case 'odor_on_awc':
      return {
        title: 'Bundle chemotaxis overlay',
        summary:
          'Food and odor cues are projected onto the AWC/AIY/AIB motif from the bundle model, balancing attraction with run stabilization.',
        route: resolveRoute(presetKey, features.bias, sideHint),
        dominantDrive: 'chemo' as const,
        presetKey,
      };
    case 'noxious_ash':
      return {
        title: 'Bundle avoidance overlay',
        summary:
          'Aversive drive is routed through the ASH-centered scaffold, combining reversal command and reorientation-linked interneuron flow.',
        route: resolveRoute(presetKey, features.bias, sideHint),
        dominantDrive: 'reverse' as const,
        presetKey,
      };
    case 'oxygen_upshift':
    default:
      return {
        title: 'Bundle roaming overlay',
        summary:
          'Weak external bias shifts the bundle model toward a URX/RMG-like roaming motif, sustaining arousal and exploratory forward drive.',
        route: resolveRoute('oxygen_upshift', features.bias, sideHint),
        dominantDrive: 'exploration' as const,
        presetKey: 'oxygen_upshift' as const,
      };
  }
}

function stimulusScaleForPreset(
  presetKey: PresetKey,
  features: ReturnType<typeof computeStimulusFeatures>,
  state: WormBehaviorState,
) {
  switch (presetKey) {
    case 'anterior_touch':
      return clamp01(0.28 + features.touchSalience * 0.9 + features.reverseDrive * 0.24);
    case 'posterior_touch':
      return clamp01(0.2 + features.forwardDrive * 0.74);
    case 'warm_pulse_afd':
      return clamp01(0.18 + features.thermoSalience * 0.96);
    case 'odor_on_awc':
      return clamp01(0.26 + features.chemoSalience * 0.82 + features.foodProximity * 0.18);
    case 'noxious_ash':
      return clamp01(0.24 + features.aversiveDrive * 0.92);
    case 'oxygen_upshift':
    default:
      return clamp01(0.18 + features.explorationDrive * 0.72 + features.forwardDrive * 0.22 + (state === 'cruise' ? 0.05 : 0));
  }
}

function blendPresets(weights: Record<PresetKey, number>): BlendedConnectomeBModel {
  const baseline = new Map<string, number>();
  const signedStimulusTargets = new Map<string, number>();
  const effectiveEdges = new Map<string, ConnectomeBPresetEdge>();

  for (const key of PRESET_KEYS) {
    const blendWeight = weights[key];
    if (blendWeight <= 0.015) continue;

    const preset = PRESETS[key];

    for (const [name, value] of Object.entries(preset.baseline)) {
      baseline.set(name, (baseline.get(name) ?? 0) + value * blendWeight);
    }

    for (const target of preset.stimulusTargets) {
      const signedValue = target.amp * target.sign * blendWeight;
      signedStimulusTargets.set(target.name, (signedStimulusTargets.get(target.name) ?? 0) + signedValue);
    }

    for (const edge of preset.effectiveEdges) {
      const edgeKey = `${edge.source}->${edge.target}`;
      const existing = effectiveEdges.get(edgeKey);
      if (existing) {
        existing.weight += edge.weight * blendWeight;
      } else {
        effectiveEdges.set(edgeKey, {
          source: edge.source,
          target: edge.target,
          weight: edge.weight * blendWeight,
        });
      }
    }
  }

  return {
    weights,
    baseline: Object.fromEntries(baseline),
    stimulusTargets: Array.from(signedStimulusTargets.entries())
      .filter(([, value]) => Math.abs(value) > 0.002)
      .map(([name, value]) => ({
        name,
        amp: Math.abs(value),
        sign: value >= 0 ? 1 : -1,
      })),
    effectiveEdges: Array.from(effectiveEdges.values()).filter((edge) => Math.abs(edge.weight) > 0.002),
  };
}

function iterateBundleModel(
  model: BlendedConnectomeBModel,
  features: ReturnType<typeof computeStimulusFeatures>,
  state: WormBehaviorState,
) {
  const activity = new Float32Array(NODES.length);
  const baseline = new Float32Array(NODES.length);

  for (const [name, value] of Object.entries(model.baseline)) {
    const index = NODE_INDEX_BY_NAME.get(name);
    if (index !== undefined) baseline[index] = clampSigned(value);
  }

  const stimulusScale = PRESET_KEYS.reduce(
    (total, key) => total + model.weights[key] * stimulusScaleForPreset(key, features, state),
    0,
  );

  const input = new Float32Array(NODES.length);

  for (const target of model.stimulusTargets) {
    const index = NODE_INDEX_BY_NAME.get(target.name);
    if (index === undefined) continue;

    let sideBoost = 1;
    if (target.name.endsWith('L')) {
      sideBoost += Math.max(0, -features.bias) * 0.35;
    } else if (target.name.endsWith('R')) {
      sideBoost += Math.max(0, features.bias) * 0.35;
    }

    sideBoost += Math.abs(features.chemoGradient) * model.weights.odor_on_awc * 0.22;
    sideBoost += Math.abs(features.thermoGradient) * model.weights.warm_pulse_afd * 0.2;

    input[index] += stimulusScale * target.amp * target.sign * sideBoost;
  }

  const params = {
    decay: state === 'turn' ? 0.82 : 0.87,
    curatedGain: 0.22 + (model.weights.noxious_ash + model.weights.anterior_touch) * 0.14,
    chemicalGain: 0.052 + (model.weights.odor_on_awc + model.weights.warm_pulse_afd) * 0.016,
    gapGain: 0.022 + model.weights.oxygen_upshift * 0.008,
    iterations: 5,
  };

  let totalInput = new Float32Array(NODES.length);

  for (let iteration = 0; iteration < params.iterations; iteration += 1) {
    const x = new Float32Array(NODES.length);
    for (let index = 0; index < NODES.length; index += 1) {
      x[index] = clampSigned(baseline[index] + activity[index]);
    }

    const next = new Float32Array(NODES.length);
    for (let index = 0; index < NODES.length; index += 1) {
      next[index] = params.decay * activity[index];
    }

    const curatedTerm = new Float32Array(NODES.length);
    const chemicalTerm = new Float32Array(NODES.length);
    const gapTerm = new Float32Array(NODES.length);

    for (const edge of model.effectiveEdges) {
      const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
      const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
      if (sourceIndex === undefined || targetIndex === undefined) continue;
      curatedTerm[targetIndex] += edge.weight * Math.tanh(x[sourceIndex]);
    }

    for (let sourceIndex = 0; sourceIndex < CHEMICAL_ADJ.length; sourceIndex += 1) {
      const sourceValue = Math.tanh(x[sourceIndex]);
      for (const edge of CHEMICAL_ADJ[sourceIndex]) {
        chemicalTerm[edge.targetIndex] += edge.weight * sourceValue;
      }
    }

    for (let sourceIndex = 0; sourceIndex < GAP_ADJ.length; sourceIndex += 1) {
      for (const edge of GAP_ADJ[sourceIndex]) {
        gapTerm[edge.targetIndex] += edge.weight * (x[sourceIndex] - x[edge.targetIndex]);
      }
    }

    totalInput = new Float32Array(NODES.length);
    for (let index = 0; index < NODES.length; index += 1) {
      const value =
        input[index] +
        params.curatedGain * Math.tanh(curatedTerm[index]) +
        params.chemicalGain * Math.tanh(chemicalTerm[index] * 2) +
        params.gapGain * gapTerm[index];
      totalInput[index] = value;
      next[index] += value;
    }

    const forwardCommand = groupScore(x, 'forwardCmd');
    const backwardCommand = groupScore(x, 'backwardCmd');
    const forwardMotors = groupScore(x, 'forwardMotors');
    const backwardMotors = groupScore(x, 'backwardMotors');

    for (const name of GROUPS.forwardCmd ?? []) {
      const index = NODE_INDEX_BY_NAME.get(name);
      if (index !== undefined) next[index] -= 0.04 * backwardCommand;
    }
    for (const name of GROUPS.backwardCmd ?? []) {
      const index = NODE_INDEX_BY_NAME.get(name);
      if (index !== undefined) next[index] -= 0.04 * forwardCommand;
    }
    for (const name of GROUPS.forwardMotors ?? []) {
      const index = NODE_INDEX_BY_NAME.get(name);
      if (index !== undefined) next[index] -= 0.02 * backwardMotors;
    }
    for (const name of GROUPS.backwardMotors ?? []) {
      const index = NODE_INDEX_BY_NAME.get(name);
      if (index !== undefined) next[index] -= 0.02 * forwardMotors;
    }

    for (let index = 0; index < NODES.length; index += 1) {
      activity[index] = clampSigned(next[index]);
    }
  }

  return { activity, totalInput, stimulusScale };
}

function buildPathways(
  effectiveEdges: ConnectomeBPresetEdge[],
  activity: Float32Array,
  runtime: ConnectomeBOverlayRuntime,
  dt: number,
) {
  const rawPathways = new Map<string, ConnectomeBPathway>();

  for (const edge of effectiveEdges) {
    const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
    const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const flux = edge.weight * Math.tanh(activity[sourceIndex]);
    if (Math.abs(flux) < 0.02) continue;
    rawPathways.set(`effective-${edge.source}-${edge.target}`, {
      id: `effective-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      flux,
      edgeType: 'effective',
    });
  }

  for (const edge of CHEMICAL_EDGES) {
    const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
    const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const flux = edge.weight * Math.tanh(activity[sourceIndex]) * 0.72;
    if (Math.abs(flux) < 0.028) continue;
    rawPathways.set(`chemical-${edge.source}-${edge.target}`, {
      id: `chemical-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      flux,
      edgeType: 'chemical',
    });
  }

  for (const edge of GAP_EDGES) {
    const sourceIndex = NODE_INDEX_BY_NAME.get(edge.source);
    const targetIndex = NODE_INDEX_BY_NAME.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const flux = edge.weight * (activity[sourceIndex] - activity[targetIndex]) * 0.82;
    if (Math.abs(flux) < 0.022) continue;
    rawPathways.set(`electrical-${edge.source}-${edge.target}`, {
      id: `electrical-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      flux,
      edgeType: 'electrical',
    });
  }

  const nextDisplayed = new Map<string, ConnectomeBPathway>();
  const riseAlpha = timeAlpha(dt, 0.09);
  const fallAlpha = timeAlpha(dt, 0.26);
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
      const smoothedFlux = lerpValue(previousFlux, raw.flux, alpha);
      nextDisplayed.set(id, { ...raw, flux: smoothedFlux });
      continue;
    }

    if (previous) {
      const decayedFlux = previous.flux * (1 - fallAlpha * 0.92);
      if (Math.abs(decayedFlux) > 0.012) {
        nextDisplayed.set(id, { ...previous, flux: decayedFlux });
      }
    }
  }

  runtime.displayedPathways = nextDisplayed;

  const visible = Array.from(nextDisplayed.values()).filter((pathway) => {
    const magnitude = Math.abs(pathway.flux);
    if (pathway.edgeType === 'effective') return magnitude >= 0.024;
    if (pathway.edgeType === 'chemical') return magnitude >= 0.022;
    return magnitude >= 0.018;
  });

  visible.sort((left, right) => Math.abs(right.flux) - Math.abs(left.flux));
  return visible.slice(0, 36);
}

function computeReadout(activity: Float32Array) {
  const forwardScore =
    0.6 * groupScore(activity, 'forwardCmd') + 0.4 * groupScore(activity, 'forwardMotors');
  const backwardScore =
    0.6 * groupScore(activity, 'backwardCmd') + 0.4 * groupScore(activity, 'backwardMotors');
  const turnScore = groupScore(activity, 'turnNodes') - 0.35 * groupScore(activity, 'aiyNodes');
  const arousalScore = groupScore(activity, 'arousalNodes');

  return {
    forwardScore,
    backwardScore,
    turnScore,
    arousalScore,
  };
}

export function buildConnectomeBFrame(sim: WormSimulation, snapshot: Snapshot): ConnectomeBFrame {
  const runtime = getOverlayRuntime(sim, snapshot);
  if (runtime.cachedFrame && Math.abs(runtime.lastElapsed - snapshot.metrics.elapsed) < 1e-6) {
    return runtime.cachedFrame;
  }

  const dt =
    runtime.lastElapsed >= 0
      ? Math.max(1 / 120, Math.min(0.18, snapshot.metrics.elapsed - runtime.lastElapsed))
      : 1 / 60;
  const features = computeStimulusFeatures(sim, snapshot);
  const rawWeights = computePresetWeights(features, snapshot.state);
  const presetWeights = smoothPresetWeights(runtime, rawWeights, dt);
  const presetKey = resolveDominantPreset(presetWeights, runtime.dominantPreset);
  runtime.dominantPreset = presetKey;
  const narrative = buildNarrative(presetKey, features);
  const blendedModel = blendPresets(presetWeights);
  const rawModel = iterateBundleModel(blendedModel, features, snapshot.state);
  const activityAlpha = timeAlpha(dt, 0.12);
  const inputAlpha = timeAlpha(dt, 0.16);

  for (let index = 0; index < NODES.length; index += 1) {
    const previousActivity = runtime.smoothedActivity[index];
    const nextActivity = rawModel.activity[index];
    const localAlpha =
      Math.abs(nextActivity) >= Math.abs(previousActivity) ? activityAlpha : inputAlpha;
    runtime.smoothedActivity[index] = clampSigned(lerpValue(previousActivity, nextActivity, localAlpha));
    runtime.smoothedInput[index] = lerpValue(
      runtime.smoothedInput[index],
      rawModel.totalInput[index],
      inputAlpha,
    );
  }

  const readout = computeReadout(runtime.smoothedActivity);
  const pathways = buildPathways(blendedModel.effectiveEdges, runtime.smoothedActivity, runtime, dt);

  const activities: Record<string, number> = {};
  const effectiveInputs: Record<string, number> = {};

  for (let index = 0; index < NODES.length; index += 1) {
    activities[NODES[index].name] = runtime.smoothedActivity[index];
    effectiveInputs[NODES[index].name] = runtime.smoothedInput[index];
  }

  const topNeurons = NODES.map((node, index) => {
    const detail = describeConnectomeBNeuron(node.name);
    const signedActivity = runtime.smoothedActivity[index];
    return {
      ...detail,
      activation: Math.abs(signedActivity),
      signedActivity,
      effectiveInput: runtime.smoothedInput[index],
    } satisfies ConnectomeBNeuronActivity;
  })
    .sort((left, right) => right.activation - left.activation)
    .slice(0, 14);

  const highlightedNames = Array.from(
    new Set([
      ...narrative.route,
      ...topNeurons.slice(0, 10).map((entry) => entry.name),
      ...pathways.slice(0, 18).flatMap((edge) => [edge.source, edge.target]),
    ]),
  );

  const signals: ConnectomeBSignal[] = [
    {
      key: 'chemo',
      label: 'Chemical gradient',
      value: features.chemoSalience,
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
      value: features.thermoSalience,
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
      value: clamp01(Math.max(features.turnDrive, Math.max(0, readout.turnScore))),
      polarity:
        features.bias > 0.08 ? 'right' : features.bias < -0.08 ? 'left' : 'neutral',
    },
    {
      key: 'reverse',
      label: 'Reverse drive',
      value: clamp01(Math.max(features.reverseDrive, readout.backwardScore)),
    },
  ];

  const frame: ConnectomeBFrame = {
    activities,
    effectiveInputs,
    topNeurons,
    highlightedNames,
    pathways,
    narrative,
    state: snapshot.state,
    foodProximity: features.foodProximity,
    forwardDrive: clamp01(Math.max(features.forwardDrive, readout.forwardScore)),
    reverseDrive: clamp01(Math.max(features.reverseDrive, readout.backwardScore)),
    turnDrive: clamp01(Math.max(features.turnDrive, Math.max(0, readout.turnScore))),
    signals,
  };

  runtime.lastElapsed = snapshot.metrics.elapsed;
  runtime.cachedFrame = frame;
  return frame;
}
