import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bundleDir = path.join(os.homedir(), 'Downloads', 'celegans_overlay_simulator_extension_bundle');
const nodesPath = path.join(bundleDir, 'celegans_302_atlas_nodes.csv');
const edgesPath = path.join(bundleDir, 'celegans_302_neuron_edges.csv');
const prototypePath = path.join(bundleDir, 'celegans_302_overlay_simulator_prototype.html');
const outputPath = path.join(process.cwd(), 'src', 'data', 'connectomeBData.json');

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let quoted = false;

  const pushCell = () => {
    row.push(current);
    current = '';
  };

  const pushRow = () => {
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      pushCell();
      continue;
    }

    if (char === '\n') {
      pushCell();
      pushRow();
      continue;
    }

    if (char !== '\r') {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])),
  );
}

function round(value, precision = 6) {
  return Number(value.toFixed(precision));
}

function extractConstArray(html, name) {
  const match = html.match(new RegExp(`const ${name} = \\[([^\\]]+)\\];`));
  if (!match) {
    throw new Error(`Could not extract ${name} from prototype HTML.`);
  }
  return match[1]
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function extractJsonConst(html, name, nextConstName) {
  const pattern = new RegExp(
    `const ${name} = (\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\]);\\s*const ${nextConstName}`,
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Could not extract ${name} from prototype HTML.`);
  }
  return JSON.parse(match[1]);
}

const nodesCsv = fs.readFileSync(nodesPath, 'utf8');
const edgesCsv = fs.readFileSync(edgesPath, 'utf8');
const prototypeHtml = fs.readFileSync(prototypePath, 'utf8');

const nodeRows = parseCsv(nodesCsv);
const edgeRows = parseCsv(edgesCsv);
const presetsRaw = extractJsonConst(prototypeHtml, 'PRESETS', 'RUNTIME_SPEC');

const nodes = nodeRows.map((row) => ({
  name: row.neuron,
  x: round(Number(row.x)),
  y: round(Number(row.y)),
  z: round(Number(row.z)),
  xNorm: round(Number(row.x_norm)),
  yNorm: round(Number(row.y_norm)),
  zNorm: round(Number(row.z_norm)),
  role: row.primary_role,
  bodyZone: row.body_zone,
  side: row.side,
}));

const nameByIndex = nodes.map((node) => node.name);
const totals = {
  chemical: new Map(),
  electrical: new Map(),
};

for (const row of edgeRows) {
  const edgeType = row.edge_type;
  if (edgeType !== 'chemical' && edgeType !== 'electrical') continue;
  const source = row.source;
  const weight = Number(row.weight);
  totals[edgeType].set(source, (totals[edgeType].get(source) ?? 0) + weight);
}

function normalizeEdge(row) {
  const edgeType = row.edge_type;
  const total = totals[edgeType].get(row.source) ?? Number(row.weight) ?? 1;
  return {
    source: row.source,
    target: row.target,
    weight: round(Number(row.weight) / Math.max(total, 1)),
    edgeType,
    sourceRole: row.source_role,
    targetRole: row.target_role,
    sourceZone: row.source_zone,
    targetZone: row.target_zone,
  };
}

const chemicalEdges = edgeRows
  .filter((row) => row.edge_type === 'chemical')
  .map(normalizeEdge);

const gapEdges = edgeRows
  .filter((row) => row.edge_type === 'electrical')
  .map(normalizeEdge);

function indexToName(index) {
  const name = nameByIndex[index];
  if (!name) {
    throw new Error(`Missing node for index ${index}.`);
  }
  return name;
}

function normalizePreset(preset) {
  const baseline = Object.fromEntries(
    Object.entries(preset.baseline ?? {}).map(([index, value]) => [
      indexToName(Number(index)),
      round(Number(value)),
    ]),
  );

  const stimulusTargets = (preset.stimulus_targets ?? []).map((target) => ({
    name: target.n,
    amp: round(Number(target.amp)),
    sign: round(Number(target.sign)),
  }));

  const effectiveEdges = (preset.effective_edges ?? []).map(([source, target, weight]) => ({
    source: indexToName(Number(source)),
    target: indexToName(Number(target)),
    weight: round(Number(weight)),
  }));

  const route = Array.from(
    new Set([
      ...stimulusTargets.map((target) => target.name),
      ...effectiveEdges.flatMap((edge) => [edge.source, edge.target]),
    ]),
  ).slice(0, 8);

  return {
    label: preset.label,
    category: preset.category,
    summary: preset.summary,
    modelingNote: preset.modeling_note,
    expectedEffect: preset.expected_effect,
    stimulusTargets,
    baseline,
    effectiveEdges,
    route,
  };
}

const presets = Object.fromEntries(
  Object.entries(presetsRaw).map(([key, preset]) => [key, normalizePreset(preset)]),
);

const groups = Object.fromEntries(
  [
    'forwardCmd',
    'backwardCmd',
    'turnNodes',
    'aiyNodes',
    'arousalNodes',
    'forwardMotors',
    'backwardMotors',
  ].map((name) => [name, extractConstArray(prototypeHtml, name).map(indexToName)]),
);

const payload = {
  nodes,
  chemicalEdges,
  gapEdges,
  presets,
  groups,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
