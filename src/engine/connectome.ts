import { cElegans302Atlas, type CElegansAtlasNeuron } from '../data/cElegans302Atlas';
import type { Snapshot, SimConfig, WormBehaviorState } from './types';
import type { WormSimulation } from './WormSimulation';

export type ConnectomeRole =
  | 'sensory'
  | 'interneuron'
  | 'command'
  | 'motor'
  | 'pharyngeal'
  | 'modulatory'
  | 'other';

export interface ConnectomeSignal {
  key: string;
  label: string;
  value: number;
  polarity?: 'left' | 'right' | 'neutral';
}

export interface ConnectomePathway {
  id: string;
  from: string;
  to: string;
  strength: number;
  family: 'sensory' | 'integration' | 'motor';
}

export interface ConnectomeNarrative {
  title: string;
  summary: string;
  route: string[];
  dominantDrive: 'chemo' | 'thermo' | 'touch' | 'exploration' | 'forward' | 'reverse';
}

export interface ConnectomeNeuronDetail {
  name: string;
  role: ConnectomeRole;
  label: string;
  summary: string;
}

export interface ConnectomeNeuronActivity extends ConnectomeNeuronDetail {
  activation: number;
  entry: CElegansAtlasNeuron;
}

export interface ConnectomeFrame {
  activities: Record<string, number>;
  topNeurons: ConnectomeNeuronActivity[];
  highlightedNames: string[];
  pathways: ConnectomePathway[];
  narrative: ConnectomeNarrative;
  signals: ConnectomeSignal[];
  state: WormBehaviorState;
  foodProximity: number;
  forwardDrive: number;
  reverseDrive: number;
  turnDrive: number;
}

const ATLAS_BY_NAME = new Map(cElegans302Atlas.map((entry) => [entry.name, entry]));
const FAMILY_MAP = new Map<string, CElegansAtlasNeuron[]>();
const GANGLION_MAP = new Map<string, CElegansAtlasNeuron[]>();

for (const entry of cElegans302Atlas) {
  const familyList = FAMILY_MAP.get(entry.family) ?? [];
  familyList.push(entry);
  FAMILY_MAP.set(entry.family, familyList);

  const ganglionList = GANGLION_MAP.get(entry.ganglion) ?? [];
  ganglionList.push(entry);
  GANGLION_MAP.set(entry.ganglion, ganglionList);
}

const ROLE_BY_FAMILY: Record<string, ConnectomeRole> = {
  ADF: 'sensory',
  ADL: 'sensory',
  AFD: 'sensory',
  AQR: 'sensory',
  ASE: 'sensory',
  ASG: 'sensory',
  ASH: 'sensory',
  ASI: 'sensory',
  ASJ: 'sensory',
  ASK: 'sensory',
  AWC: 'sensory',
  BAG: 'sensory',
  FLP: 'sensory',
  IL1: 'sensory',
  IL2: 'sensory',
  OLL: 'sensory',
  OLQ: 'sensory',
  PHA: 'sensory',
  PHB: 'sensory',
  PHC: 'sensory',
  PLM: 'sensory',
  PVD: 'sensory',
  PVM: 'sensory',
  SDQ: 'sensory',
  URB: 'sensory',
  URX: 'sensory',
  AIA: 'interneuron',
  AIA_: 'interneuron',
  AIB: 'interneuron',
  AIM: 'interneuron',
  AIN: 'interneuron',
  AIY: 'interneuron',
  AIZ: 'interneuron',
  AUA: 'interneuron',
  RIA: 'interneuron',
  RIB: 'interneuron',
  RIC: 'interneuron',
  RID: 'interneuron',
  RIF: 'interneuron',
  RIG: 'interneuron',
  RIH: 'interneuron',
  RIM: 'interneuron',
  RIP: 'interneuron',
  RIR: 'interneuron',
  RIS: 'interneuron',
  RIV: 'interneuron',
  ALA: 'modulatory',
  NSM: 'modulatory',
  CEP: 'modulatory',
  ADE: 'modulatory',
  PDE: 'modulatory',
  AVAL: 'command',
  AVA: 'command',
  AVB: 'command',
  AVD: 'command',
  AVE: 'command',
  PVC: 'command',
  AVJ: 'command',
  AVK: 'command',
  DVB: 'motor',
  AVL: 'motor',
  DA: 'motor',
  DB: 'motor',
  DD: 'motor',
  VA: 'motor',
  VB: 'motor',
  VD: 'motor',
  AS: 'motor',
  RMD: 'motor',
  RME: 'motor',
  RMF: 'motor',
  RMG: 'motor',
  RMH: 'motor',
  SAB: 'motor',
  SAA: 'motor',
  SIA: 'motor',
  SIB: 'motor',
  SMB: 'motor',
  SMD: 'motor',
  M1: 'pharyngeal',
  M2: 'pharyngeal',
  M3: 'pharyngeal',
  M4: 'pharyngeal',
  M5: 'pharyngeal',
  MCL: 'pharyngeal',
  MCR: 'pharyngeal',
  MI: 'pharyngeal',
  I1: 'pharyngeal',
  I2: 'pharyngeal',
  I3: 'pharyngeal',
  I4: 'pharyngeal',
  I5: 'pharyngeal',
  I6: 'pharyngeal',
};

const DETAIL_BY_FAMILY: Partial<Record<string, { label: string; summary: string }>> = {
  AFD: {
    label: 'Thermosensory pair',
    summary: 'AFD is the best-established thermosensory channel in C. elegans and strongly shapes thermal preference corrections.',
  },
  ASE: {
    label: 'Chemotaxis sensory pair',
    summary: 'ASE neurons are canonical taste and chemical gradient sensors used for steering toward favorable conditions.',
  },
  AWC: {
    label: 'Olfactory sensory pair',
    summary: 'AWC contributes odor-driven attraction and exploration state transitions in food-seeking contexts.',
  },
  ASH: {
    label: 'Nociceptive / touch sensory pair',
    summary: 'ASH is recruited during aversive contact and helps push the animal into reversal and turning programs.',
  },
  ALM: {
    label: 'Gentle touch mechanosensors',
    summary: 'ALM neurons are classic anterior touch receptors that rapidly recruit avoidance circuits.',
  },
  AVA: {
    label: 'Reverse command interneurons',
    summary: 'AVA is a central hub for backward locomotion and escape-like reversals.',
  },
  AVB: {
    label: 'Forward command interneurons',
    summary: 'AVB supports forward cruising by recruiting the B-type motor pools along the body.',
  },
  AVD: {
    label: 'Aversive command interneurons',
    summary: 'AVD relays mechanosensory and escape-related input toward the reversal network.',
  },
  AVE: {
    label: 'Reverse-support interneurons',
    summary: 'AVE partners with AVA/AVD in sustaining backward motion after aversive cues.',
  },
  AIY: {
    label: 'Chemotaxis / thermotaxis integration',
    summary: 'AIY is a major sensory integration hub that biases smooth forward navigation in favorable conditions.',
  },
  AIB: {
    label: 'Reorientation interneurons',
    summary: 'AIB is often linked to state changes, reorientation, and aversive navigation.',
  },
  AIZ: {
    label: 'Steering interneurons',
    summary: 'AIZ receives sensory integration input and relays steering signals toward locomotor command circuits.',
  },
  RIM: {
    label: 'Turn / state-switch interneurons',
    summary: 'RIM participates in reorientation and links state switching to motor execution.',
  },
  SMB: {
    label: 'Head steering motor neurons',
    summary: 'SMB motor neurons help convert turning commands into head swings and steering changes.',
  },
  RMD: {
    label: 'Head motor ring',
    summary: 'RMD neurons control head and neck posture, especially during turns and obstacle responses.',
  },
  DB: {
    label: 'Forward body motor pool',
    summary: 'B-type motor neurons are associated with forward propagation of body bends.',
  },
  VB: {
    label: 'Forward ventral motor pool',
    summary: 'VB neurons contribute to forward locomotor waves in the ventral nerve cord.',
  },
  DA: {
    label: 'Reverse body motor pool',
    summary: 'A-type motor neurons are strongly associated with backward locomotion.',
  },
  VA: {
    label: 'Reverse ventral motor pool',
    summary: 'VA neurons are recruited during backward runs and coordinated withdrawal.',
  },
  NSM: {
    label: 'Feeding-state modulators',
    summary: 'NSM neurons signal food-related internal state and help bias dwelling and food engagement.',
  },
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function pulseFor(name: string, elapsed: number) {
  const seed = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 0.022 + 0.018 * (0.5 + 0.5 * Math.sin(elapsed * 2.8 + seed * 0.07));
}

function roleFor(entry: CElegansAtlasNeuron): ConnectomeRole {
  return ROLE_BY_FAMILY[entry.family] ?? 'other';
}

export function describeConnectomeNeuron(name: string): ConnectomeNeuronDetail {
  const entry = ATLAS_BY_NAME.get(name);
  if (!entry) {
    return {
      name,
      role: 'other',
      label: 'Unclassified neuron',
      summary: 'This neuron is not part of the current atlas scaffold.',
    };
  }

  const role = roleFor(entry);
  const detail = DETAIL_BY_FAMILY[entry.family];

  return {
    name,
    role,
    label:
      detail?.label ??
      (role === 'sensory'
        ? 'Sensory neuron'
        : role === 'interneuron'
          ? 'Interneuron'
          : role === 'command'
            ? 'Command interneuron'
            : role === 'motor'
              ? 'Motor neuron'
              : role === 'pharyngeal'
                ? 'Pharyngeal neuron'
                : role === 'modulatory'
                  ? 'Modulatory neuron'
                  : 'Other neuron'),
    summary:
      detail?.summary ??
      `${entry.family} family neuron in the ${entry.ganglion}, currently treated as part of the ${role} layer in this experimental connectome model.`,
  };
}

function addActivation(store: Record<string, number>, names: string[], amount: number) {
  const value = clamp(amount);
  if (value <= 0) return;
  for (const name of names) {
    if (!ATLAS_BY_NAME.has(name)) continue;
    store[name] = clamp((store[name] ?? 0) + value);
  }
}

function addFamilyActivation(store: Record<string, number>, family: string, amount: number) {
  const entries = FAMILY_MAP.get(family);
  if (!entries) return;
  addActivation(
    store,
    entries.map((entry) => entry.name),
    amount,
  );
}

function diffuseActivity(exact: Record<string, number>, elapsed: number) {
  const activity: Record<string, number> = {};

  for (const entry of cElegans302Atlas) {
    const base =
      pulseFor(entry.name, elapsed) +
      (entry.region === 'head' ? 0.01 : entry.region === 'ventral-nerve-cord' ? 0.008 : 0.004);
    activity[entry.name] = base;
  }

  for (const [name, value] of Object.entries(exact)) {
    const entry = ATLAS_BY_NAME.get(name);
    if (!entry) continue;

    activity[name] = clamp((activity[name] ?? 0) + value);

    for (const familyPeer of FAMILY_MAP.get(entry.family) ?? []) {
      if (familyPeer.name === name) continue;
      activity[familyPeer.name] = clamp((activity[familyPeer.name] ?? 0) + value * 0.26);
    }

    for (const ganglionPeer of GANGLION_MAP.get(entry.ganglion) ?? []) {
      if (ganglionPeer.name === name) continue;
      activity[ganglionPeer.name] = clamp((activity[ganglionPeer.name] ?? 0) + value * 0.08);
    }
  }

  return activity;
}

function topActivities(activity: Record<string, number>) {
  return cElegans302Atlas
    .map((entry) => {
      const detail = describeConnectomeNeuron(entry.name);
      return {
        activation: clamp(activity[entry.name] ?? 0),
        entry,
        ...detail,
      };
    })
    .sort((left, right) => right.activation - left.activation);
}

function buildNarrative(
  bias: number,
  features: {
    chemoSalience: number;
    chemoGradient: number;
    thermoSalience: number;
    thermoGradient: number;
    touchFront: number;
    touchLeft: number;
    touchRight: number;
    foodProximity: number;
    forwardDrive: number;
    reverseDrive: number;
    turnDrive: number;
    explorationDrive: number;
  },
) {
  if (features.touchFront > 0 || features.touchLeft > 0.6 || features.touchRight > 0.6) {
    const leftEscape = features.touchLeft >= features.touchRight;
    return {
      title: 'Mechanosensory escape circuit',
      summary:
        'Touch and collision cues dominate the network, recruiting ASH/ALM/FLP-like sensory channels and the AVA/AVD reversal command system.',
      route: leftEscape ? ['ALML', 'AVDL', 'AVAL', 'DA4', 'VA5'] : ['ALMR', 'AVDR', 'AVAR', 'DA5', 'VA6'],
      dominantDrive: 'touch' as const,
    };
  }

  if (features.thermoSalience > 0.52 && features.thermoSalience >= features.chemoSalience) {
    const steerRight = features.thermoGradient >= 0;
    return {
      title: 'Thermotaxis correction circuit',
      summary:
        'Thermal error is high enough to bias AFD-centered sensory processing and AIY/AIZ steering toward a more favorable temperature zone.',
      route: steerRight ? ['AFDR', 'AIYR', 'AIZR', 'AVBR', 'VB6'] : ['AFDL', 'AIYL', 'AIZL', 'AVBL', 'DB4'],
      dominantDrive: 'thermo' as const,
    };
  }

  if (features.chemoSalience > 0.24 || features.foodProximity > 0.28) {
    const steerRight = features.chemoGradient >= 0;
    return {
      title: 'Food-seeking chemotaxis circuit',
      summary:
        'Chemical and food cues dominate, driving ASE/AWC/ADF-like sensory activity into AIY/AIZ integration and AVB/PVC forward command output.',
      route: steerRight ? ['ASER', 'AIYR', 'AIZR', 'AVBR', 'VB5'] : ['ASEL', 'AIYL', 'AIZL', 'AVBL', 'DB3'],
      dominantDrive: 'chemo' as const,
    };
  }

  if (features.turnDrive > features.forwardDrive * 0.92 || features.explorationDrive > 0.22) {
    const steerRight = bias >= 0;
    return {
      title: 'Exploratory reorientation circuit',
      summary:
        'With weak external drive, the network leans on reorientation and exploratory turns through AIB/RIM and head steering motor pools.',
      route: steerRight ? ['AIBR', 'RIMR', 'SMBDR', 'RMDR'] : ['AIBL', 'RIML', 'SMBDL', 'RMDL'],
      dominantDrive: 'exploration' as const,
    };
  }

  if (features.reverseDrive > features.forwardDrive) {
    return {
      title: 'Reverse command state',
      summary:
        'Backward locomotion dominates the connectome view, with AVA/AVD/AVE command neurons feeding A-type motor pools along the ventral cord.',
      route: ['AVAL', 'AVDL', 'AVEL', 'DA3', 'VA4'],
      dominantDrive: 'reverse' as const,
    };
  }

  return {
    title: 'Forward cruising circuit',
    summary:
      'The worm is mainly propagating forward command through AVB/PVC into B-type motor pools, with sensory channels only softly shaping steering.',
    route: ['AIYL', 'AVBL', 'PVCL', 'DB4', 'VB6'],
    dominantDrive: 'forward' as const,
  };
}

function makePathways(route: string[], activity: Record<string, number>): ConnectomePathway[] {
  return route
    .slice(0, -1)
    .map((from, index) => {
      const to = route[index + 1];
      const family =
        index === 0 ? 'sensory' : index >= route.length - 2 ? 'motor' : 'integration';
      return {
        id: `${from}-${to}`,
        from,
        to,
        family,
        strength: clamp(Math.min(activity[from] ?? 0, activity[to] ?? 0) * 1.08),
      } satisfies ConnectomePathway;
    })
    .filter((pathway) => pathway.strength > 0.12);
}

export function buildConnectomeFrame(sim: WormSimulation, snapshot: Snapshot): ConnectomeFrame {
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
  const foodProximity = clamp(1 - foodDistance / (internal.world.food.radius * 3.6));
  const chemoGradient = clamp((foodRight - foodLeft) * 2.8, -1, 1);
  const chemoSalience = clamp(Math.abs(chemoGradient) * 0.8 + foodCenter * 0.28);
  const thermoGradient = clamp(
    (Math.abs(config.world.preferredTemperature - tempLeft) -
      Math.abs(config.world.preferredTemperature - tempRight)) *
      2.4,
    -1,
    1,
  );
  const thermoSalience = clamp(snapshot.sensor.tempError * 1.8 + Math.abs(thermoGradient) * 0.55);
  const touchFront = snapshot.sensor.touchFront ? 1 : 0;
  const touchLeft = snapshot.sensor.touchLeft ? 1 : 0;
  const touchRight = snapshot.sensor.touchRight ? 1 : 0;
  const touchSalience = Math.max(touchFront, touchLeft, touchRight);
  const bias = clamp(snapshot.sensor.bias * 1.75, -1, 1);
  const leftBias = clamp(-bias);
  const rightBias = clamp(bias);
  const appetitiveDrive = clamp(foodProximity * 0.62 + chemoSalience * 0.8);
  const aversiveDrive = clamp(touchFront * 0.96 + touchSalience * 0.7 + thermoSalience * 0.34);
  const explorationDrive = clamp(
    config.behavior.exploration * 1.9 * (1 - appetitiveDrive * 0.65) * (1 - touchSalience * 0.75),
  );

  const forwardDrive = clamp(
    (snapshot.state === 'cruise' ? 0.4 : 0.18) + appetitiveDrive * 0.46 + config.behavior.gradientGain * 0.05,
  );
  const reverseDrive = clamp(
    (snapshot.state === 'reverse' ? 0.74 : 0.12) + aversiveDrive * 0.78,
  );
  const turnDrive = clamp(
    (snapshot.state === 'turn' ? 0.76 : 0.18) + Math.abs(bias) * 0.48 + explorationDrive * 0.24,
  );

  const exact: Record<string, number> = {};

  addActivation(
    exact,
    ['ASEL', 'ADFL', 'ASGL', 'ASIL', 'ASKL', 'ASJL', 'AWCL'],
    (chemoGradient < 0 ? chemoSalience : foodProximity * 0.24) * 0.95,
  );
  addActivation(
    exact,
    ['ASER', 'ADFR', 'ASGR', 'ASIR', 'ASKR', 'ASJR', 'AWCR'],
    (chemoGradient > 0 ? chemoSalience : foodProximity * 0.24) * 0.95,
  );
  addActivation(exact, ['AFDL'], thermoSalience * (thermoGradient < 0 ? 0.96 : 0.58));
  addActivation(exact, ['AFDR'], thermoSalience * (thermoGradient > 0 ? 0.96 : 0.58));
  addActivation(exact, ['NSML', 'NSMR', 'ADEL', 'ADER'], foodProximity * 0.58);
  addActivation(exact, ['ASHL', 'FLPL', 'ALML', 'PLML', 'PVDL'], touchLeft * 0.96 + touchFront * 0.28);
  addActivation(exact, ['ASHR', 'FLPR', 'ALMR', 'PLMR', 'PVDR'], touchRight * 0.96 + touchFront * 0.28);
  addActivation(exact, ['AVM', 'PVM'], touchFront * 0.82);
  addActivation(exact, ['BAGL', 'BAGR', 'URXL', 'URXR'], thermoSalience * 0.22 + explorationDrive * 0.12);

  addActivation(exact, ['AIYL', 'AIYR'], appetitiveDrive * 0.54 + thermoSalience * 0.26);
  addActivation(exact, ['AIAL', 'AIAR'], foodProximity * 0.42 + chemoSalience * 0.24);
  addActivation(exact, ['AIZL', 'AIZR'], appetitiveDrive * 0.42 + turnDrive * 0.2);
  addActivation(exact, ['AIBL', 'AIBR'], aversiveDrive * 0.56 + turnDrive * 0.3);
  addActivation(exact, ['RIAL', 'RIAR'], appetitiveDrive * 0.28 + turnDrive * 0.22);
  addActivation(exact, ['RIBL', 'RIBR'], forwardDrive * 0.52);
  addActivation(exact, ['RIML', 'RIMR'], reverseDrive * 0.36 + turnDrive * 0.62);
  addActivation(exact, ['RIVL', 'RIVR'], turnDrive * 0.56);
  addActivation(exact, ['RICL', 'RICR', 'RIGL', 'RIGR'], aversiveDrive * 0.2 + explorationDrive * 0.12);
  addActivation(exact, ['RID'], forwardDrive * 0.24);
  addActivation(exact, ['ALA'], thermoSalience * 0.16 + touchSalience * 0.18);

  addActivation(exact, ['AVBL', 'AVBR', 'PVCL', 'PVCR'], forwardDrive * 0.96);
  addActivation(exact, ['AVAL', 'AVAR', 'AVDL', 'AVDR', 'AVEL', 'AVER'], reverseDrive * 0.96);
  addActivation(exact, ['AVJL', 'AVJR'], turnDrive * 0.34);

  addFamilyActivation(exact, 'DB', forwardDrive * 0.74);
  addFamilyActivation(exact, 'VB', forwardDrive * 0.7);
  addFamilyActivation(exact, 'DA', reverseDrive * 0.72);
  addFamilyActivation(exact, 'VA', reverseDrive * 0.68);
  addFamilyActivation(exact, 'DD', reverseDrive * 0.4);
  addFamilyActivation(exact, 'VD', forwardDrive * 0.16 + reverseDrive * 0.34);
  addFamilyActivation(exact, 'AS', turnDrive * 0.36 + reverseDrive * 0.16);
  addFamilyActivation(exact, 'SMB', turnDrive * 0.72);
  addFamilyActivation(exact, 'SMD', turnDrive * 0.48);
  addFamilyActivation(exact, 'RMD', turnDrive * 0.64 + touchFront * 0.22);
  addFamilyActivation(exact, 'RME', turnDrive * 0.24);
  addFamilyActivation(exact, 'SAB', turnDrive * 0.42 + forwardDrive * 0.14);
  addFamilyActivation(exact, 'SIA', forwardDrive * 0.18);
  addFamilyActivation(exact, 'SIB', turnDrive * 0.22);

  addActivation(exact, ['MCL', 'MCR', 'MI', 'M3L', 'M3R', 'M4', 'M5'], foodProximity * 0.24);
  addActivation(exact, ['I1L', 'I1R', 'I2L', 'I2R', 'I3'], foodProximity * 0.16);

  if (leftBias > rightBias) {
    addActivation(exact, ['AIYL', 'AIZL', 'RIAL', 'RIVL', 'SMBDL', 'SMBVL', 'RMDL', 'RMDDL', 'RMDVL'], leftBias * 0.34);
  } else if (rightBias > leftBias) {
    addActivation(exact, ['AIYR', 'AIZR', 'RIAR', 'RIVR', 'SMBDR', 'SMBVR', 'RMDR', 'RMDDR', 'RMDVR'], rightBias * 0.34);
  }

  const activity = diffuseActivity(exact, snapshot.metrics.elapsed);
  const narrative = buildNarrative(bias, {
    chemoSalience,
    chemoGradient,
    thermoSalience,
    thermoGradient,
    touchFront,
    touchLeft,
    touchRight,
    foodProximity,
    forwardDrive,
    reverseDrive,
    turnDrive,
    explorationDrive,
  });

  for (const routeNode of narrative.route) {
    activity[routeNode] = clamp((activity[routeNode] ?? 0) + 0.16);
  }

  const sorted = topActivities(activity);
  const topNeurons = sorted.slice(0, 14);
  const highlightedNames = Array.from(new Set([...narrative.route, ...topNeurons.slice(0, 10).map((entry) => entry.name)]));
  const pathways = makePathways(narrative.route, activity);

  return {
    activities: activity,
    topNeurons,
    highlightedNames,
    pathways,
    narrative,
    state: snapshot.state,
    foodProximity,
    forwardDrive,
    reverseDrive,
    turnDrive,
    signals: [
      {
        key: 'chemo',
        label: 'Chemical gradient',
        value: chemoSalience,
        polarity: chemoGradient > 0.08 ? 'right' : chemoGradient < -0.08 ? 'left' : 'neutral',
      },
      {
        key: 'thermo',
        label: 'Thermal error',
        value: thermoSalience,
        polarity: thermoGradient > 0.08 ? 'right' : thermoGradient < -0.08 ? 'left' : 'neutral',
      },
      {
        key: 'touch',
        label: 'Mechanosensory alert',
        value: aversiveDrive,
        polarity:
          touchLeft > touchRight ? 'left' : touchRight > touchLeft ? 'right' : touchFront > 0 ? 'neutral' : 'neutral',
      },
      {
        key: 'food',
        label: 'Food proximity',
        value: foodProximity,
      },
      {
        key: 'forward',
        label: 'Forward drive',
        value: forwardDrive,
      },
      {
        key: 'turn',
        label: 'Turn drive',
        value: turnDrive,
        polarity: bias > 0.08 ? 'right' : bias < -0.08 ? 'left' : 'neutral',
      },
      {
        key: 'reverse',
        label: 'Reverse drive',
        value: reverseDrive,
      },
    ],
  };
}
