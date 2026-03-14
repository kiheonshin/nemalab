from __future__ import annotations

import csv
import io
import json
import math
import textwrap
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np
import requests


ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs" / "research"
SRC_DATA_DIR = ROOT / "src" / "data"

BLUEVEX_ATLAS_URL = (
    "https://raw.githubusercontent.com/bluevex/elegans-atlas/main/"
    "LowResAtlasWithHighResHeadsAndTails.csv"
)
ANATLAS_POSITIONS_URL = (
    "https://raw.githubusercontent.com/francescorandi/wormneuroatlas/main/"
    "wormneuroatlas/data/anatlas_neuron_positions.txt"
)
GANGLIA_URL = (
    "https://raw.githubusercontent.com/francescorandi/wormneuroatlas/main/"
    "wormneuroatlas/data/aconnectome_ids_ganglia.json"
)

GANGLION_ORDER = [
    "anterior ganglion",
    "dorsal ganglion",
    "lateral ganglion",
    "ventral ganglion",
    "retrovesicular ganglion",
    "anterior pharyngeal bulb",
    "posterior pharyngeal bulb",
    "ventral nerve cord",
    "midbody neurons",
    "preanal ganglion",
    "dorsorectal ganglion",
    "lumbar ganglion",
]

GANGLION_REGION = {
    "anterior ganglion": "head",
    "dorsal ganglion": "head",
    "lateral ganglion": "head",
    "ventral ganglion": "head",
    "retrovesicular ganglion": "head",
    "anterior pharyngeal bulb": "pharynx",
    "posterior pharyngeal bulb": "pharynx",
    "ventral nerve cord": "ventral-nerve-cord",
    "midbody neurons": "midbody",
    "preanal ganglion": "tail",
    "dorsorectal ganglion": "tail",
    "lumbar ganglion": "tail",
}

GANGLION_COLORS = {
    "anterior ganglion": "#7DE2CF",
    "dorsal ganglion": "#A6E07B",
    "lateral ganglion": "#72C7FF",
    "ventral ganglion": "#FFBC6C",
    "retrovesicular ganglion": "#F68FB1",
    "anterior pharyngeal bulb": "#FFD36E",
    "posterior pharyngeal bulb": "#FFAA54",
    "ventral nerve cord": "#B388FF",
    "midbody neurons": "#79B8FF",
    "preanal ganglion": "#FF8C8C",
    "dorsorectal ganglion": "#FF6E9A",
    "lumbar ganglion": "#8CE99A",
}

SOURCE_NOTES = {
    "bluevex-2022": "Direct position from Long et al. 2022 / bluevex atlas.",
    "anatlas-affine-can": (
        "CAN position affine-projected into the Long et al. 2022 coordinate frame "
        "from the WormNeuroAtlas anatomical atlas. This is an inference."
    ),
}

GANGLION_INFERENCE = {
    "DB7": "preanal ganglion",
    "VA11": "preanal ganglion",
    "RMHR": "ventral ganglion",
}


def fetch_text(url: str) -> str:
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.text


def load_bluevex_atlas() -> Dict[str, Tuple[float, float, float]]:
    rows = csv.reader(io.StringIO(fetch_text(BLUEVEX_ATLAS_URL)))
    atlas: Dict[str, Tuple[float, float, float]] = {}
    for row in rows:
        if not row:
            continue
        atlas[row[0]] = tuple(float(value) for value in row[1:4])
    return atlas


def load_anatlas_positions() -> Dict[str, Tuple[float, float, float]]:
    lines = fetch_text(ANATLAS_POSITIONS_URL).strip().splitlines()
    names = lines[0].lstrip("#").split()
    coords = [tuple(float(value) for value in line.split()) for line in lines[1:]]
    atlas: Dict[str, Tuple[float, float, float]] = {}
    for name, coord in zip(names, coords):
        if name not in atlas:
            atlas[name] = coord
    return atlas


def load_ganglia() -> Tuple[Dict[str, str], Dict[str, List[str]]]:
    raw = json.loads(fetch_text(GANGLIA_URL))
    neuron_to_ganglion: Dict[str, str] = {}
    grouped: Dict[str, List[str]] = {}
    for ganglion in GANGLION_ORDER:
        neurons = raw[ganglion]
        grouped[ganglion] = list(neurons)
        for neuron in neurons:
            neuron_to_ganglion[neuron] = ganglion
    return neuron_to_ganglion, grouped


def fit_affine_transform(
    source_points: Dict[str, Tuple[float, float, float]],
    target_points: Dict[str, Tuple[float, float, float]],
) -> Tuple[np.ndarray, float]:
    shared = sorted(set(source_points) & set(target_points))
    source = np.array([[*source_points[name], 1.0] for name in shared], dtype=float)
    target = np.array([target_points[name] for name in shared], dtype=float)
    transform, _, _, _ = np.linalg.lstsq(source, target, rcond=None)
    predicted = source @ transform
    rmse = float(np.sqrt(np.mean((predicted - target) ** 2)))
    return transform, rmse


def apply_affine(transform: np.ndarray, point: Tuple[float, float, float]) -> Tuple[float, float, float]:
    projected = np.array([*point, 1.0], dtype=float) @ transform
    return tuple(float(value) for value in projected)


def normalize(value: float, min_value: float, max_value: float) -> float:
    return (value - min_value) / (max_value - min_value)


def infer_side(name: str) -> str:
    if name.endswith("L"):
        return "left"
    if name.endswith("R"):
        return "right"
    return "midline"


def infer_family(name: str) -> str:
    trimmed = name
    for suffix in ("OFF", "ON", "DL", "DR", "VL", "VR", "L", "R", "D", "V"):
        if trimmed.endswith(suffix) and len(trimmed) > len(suffix):
            trimmed = trimmed[: -len(suffix)]
            break

    if trimmed in {"I1", "I2", "I3", "I4", "I5", "I6", "M1", "M2", "M3", "M4", "M5", "IL1", "IL2"}:
        return trimmed

    while trimmed and trimmed[-1].isdigit():
        trimmed = trimmed[:-1]

    return trimmed or name


def build_entries() -> Tuple[List[dict], Dict[str, List[str]], float]:
    bluevex = load_bluevex_atlas()
    anatlas = load_anatlas_positions()
    neuron_to_ganglion, grouped = load_ganglia()
    transform, rmse = fit_affine_transform(anatlas, bluevex)

    combined = dict(bluevex)
    for name in ("CANL", "CANR"):
        combined[name] = apply_affine(transform, anatlas[name])

    xs = [coord[0] for coord in combined.values()]
    ys = [coord[1] for coord in combined.values()]
    zs = [coord[2] for coord in combined.values()]

    entries: List[dict] = []
    for name, (x_pos, y_pos, z_pos) in sorted(combined.items(), key=lambda item: item[1][0]):
        if name in neuron_to_ganglion:
            ganglion = neuron_to_ganglion[name]
            ganglion_source = "wormneuroatlas"
        else:
            ganglion = GANGLION_INFERENCE[name]
            ganglion_source = "nearest-ganglion-inference"
        region = GANGLION_REGION[ganglion]
        source = "bluevex-2022" if name in bluevex else "anatlas-affine-can"
        entries.append(
            {
                "name": name,
                "family": infer_family(name),
                "ganglion": ganglion,
                "ganglionSource": ganglion_source,
                "region": region,
                "side": infer_side(name),
                "position3d": {
                    "x": round(x_pos, 2),
                    "y": round(y_pos, 2),
                    "z": round(z_pos, 2),
                },
                "projection": {
                    "dorsal": {
                        "x": round(normalize(x_pos, min(xs), max(xs)), 4),
                        "y": round(normalize(z_pos, min(zs), max(zs)), 4),
                    },
                    "lateral": {
                        "x": round(normalize(x_pos, min(xs), max(xs)), 4),
                        "y": round(normalize(y_pos, min(ys), max(ys)), 4),
                    },
                },
                "source": source,
            }
        )

    return entries, grouped, rmse


def wrap_names(names: Iterable[str], max_chars: int = 60) -> List[str]:
    chunks: List[str] = []
    current = ""
    for name in names:
        candidate = f"{current}, {name}" if current else name
        if len(candidate) > max_chars:
            chunks.append(current)
            current = name
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def render_worm_outline(
    x_left: float,
    x_right: float,
    y_center: float,
    max_radius: float,
    samples: int = 80,
) -> str:
    top = []
    bottom = []
    for index in range(samples):
        t = index / (samples - 1)
        x_pos = x_left + (x_right - x_left) * t
        radius = max_radius * (0.16 + 0.84 * (math.sin(math.pi * t) ** 0.72))
        top.append((x_pos, y_center - radius))
        bottom.append((x_pos, y_center + radius))
    points = top + list(reversed(bottom))
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


def render_svg(entries: List[dict], grouped: Dict[str, List[str]], rmse: float) -> str:
    width = 2200
    height = 1560
    margin = 90
    main_width = 1180
    panel_height = 520
    legend_x = 1320
    dorsal_top = 180
    lateral_top = 860
    body_left = margin
    body_right = main_width
    body_center_y = dorsal_top + panel_height / 2
    side_center_y = lateral_top + panel_height / 2

    xs = [entry["position3d"]["x"] for entry in entries]
    ys = [entry["position3d"]["y"] for entry in entries]
    zs = [entry["position3d"]["z"] for entry in entries]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)

    def map_x(value: float) -> float:
        return body_left + 50 + (value - min_x) / (max_x - min_x) * (body_right - body_left - 100)

    def map_z(value: float) -> float:
        return dorsal_top + panel_height - 45 - (value - min_z) / (max_z - min_z) * (panel_height - 90)

    def map_y(value: float) -> float:
        return lateral_top + panel_height - 45 - (value - min_y) / (max_y - min_y) * (panel_height - 90)

    legend_blocks = []
    legend_cursor_y = 180
    for ganglion in GANGLION_ORDER:
        neurons = grouped[ganglion]
        color = GANGLION_COLORS[ganglion]
        wrapped = wrap_names(neurons)
        line_height = 22
        block_height = 64 + len(wrapped) * line_height
        legend_blocks.append(
            f"""
            <g transform="translate({legend_x}, {legend_cursor_y})">
              <rect width="760" height="{block_height}" rx="22" fill="rgba(15,20,29,0.76)" stroke="rgba(255,255,255,0.08)" />
              <rect x="24" y="22" width="16" height="16" rx="8" fill="{color}" />
              <text x="54" y="36" class="legend-title">{ganglion} ({len(neurons)})</text>
              {''.join(f'<text x="24" y="{70 + idx * line_height}" class="legend-text">{line}</text>' for idx, line in enumerate(wrapped))}
            </g>
            """
        )
        legend_cursor_y += block_height + 18

    circles_dorsal = []
    circles_lateral = []
    labels = []
    for entry in entries:
        color = GANGLION_COLORS[entry["ganglion"]]
        x_pos = map_x(entry["position3d"]["x"])
        z_pos = map_z(entry["position3d"]["z"])
        y_pos = map_y(entry["position3d"]["y"])
        label_dy = -10 if entry["side"] == "left" else 16 if entry["side"] == "right" else 3
        label_anchor = "end" if entry["side"] == "left" else "start"
        label_dx = -8 if entry["side"] == "left" else 8

        circles_dorsal.append(
            f'<circle cx="{x_pos:.1f}" cy="{z_pos:.1f}" r="4.4" fill="{color}" stroke="rgba(8,10,16,0.95)" stroke-width="1.2" />'
        )
        circles_lateral.append(
            f'<circle cx="{x_pos:.1f}" cy="{y_pos:.1f}" r="4.4" fill="{color}" stroke="rgba(8,10,16,0.95)" stroke-width="1.2" />'
        )
        labels.append(
            f'<text x="{x_pos + label_dx:.1f}" y="{z_pos + label_dy:.1f}" text-anchor="{label_anchor}" class="node-label">{entry["name"]}</text>'
        )

    dorsal_outline = render_worm_outline(body_left + 38, body_right - 38, body_center_y, 118)
    lateral_outline = render_worm_outline(body_left + 38, body_right - 38, side_center_y, 110)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#081019" />
      <stop offset="100%" stop-color="#111927" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
  </defs>
  <style>
    .title {{ font: 700 42px ui-sans-serif, system-ui, sans-serif; fill: #F4FBFF; }}
    .subtitle {{ font: 500 20px ui-sans-serif, system-ui, sans-serif; fill: rgba(226,235,245,0.78); }}
    .panel-title {{ font: 700 22px ui-sans-serif, system-ui, sans-serif; fill: #F4FBFF; }}
    .panel-note {{ font: 500 14px ui-sans-serif, system-ui, sans-serif; fill: rgba(226,235,245,0.64); }}
    .axis-label {{ font: 600 13px ui-sans-serif, system-ui, sans-serif; fill: rgba(226,235,245,0.55); letter-spacing: 0.08em; text-transform: uppercase; }}
    .legend-title {{ font: 700 18px ui-sans-serif, system-ui, sans-serif; fill: #F6FBFF; }}
    .legend-text {{ font: 500 13px ui-sans-serif, system-ui, sans-serif; fill: rgba(226,235,245,0.78); }}
    .node-label {{ font: 600 8.4px ui-monospace, SFMono-Regular, Menlo, monospace; fill: rgba(240,247,255,0.82); }}
    .footer {{ font: 500 13px ui-sans-serif, system-ui, sans-serif; fill: rgba(226,235,245,0.62); }}
  </style>
  <rect width="{width}" height="{height}" fill="url(#bg)" />
  <circle cx="240" cy="200" r="160" fill="rgba(125,226,207,0.09)" filter="url(#softGlow)" />
  <circle cx="960" cy="1120" r="220" fill="rgba(114,199,255,0.08)" filter="url(#softGlow)" />

  <text x="90" y="78" class="title">C. elegans 302-Neuron Atlas Scaffold</text>
  <text x="90" y="112" class="subtitle">Research-backed anatomical map for stimulus-to-neuron-to-motor visualization in Nema Lab</text>

  <g transform="translate(0, 0)">
    <rect x="56" y="142" width="1188" height="562" rx="28" fill="rgba(15,20,29,0.82)" stroke="rgba(255,255,255,0.08)" />
    <text x="90" y="178" class="panel-title">Dorsal Projection (AP × LR)</text>
    <text x="90" y="202" class="panel-note">Head on the left, tail on the right. Labels are attached to all 302 neurons.</text>
    <polygon points="{dorsal_outline}" fill="rgba(125,226,207,0.07)" stroke="rgba(125,226,207,0.20)" stroke-width="2" />
    <text x="102" y="660" class="axis-label">Head</text>
    <text x="1120" y="660" class="axis-label" text-anchor="end">Tail</text>
    {''.join(circles_dorsal)}
    {''.join(labels)}
  </g>

  <g transform="translate(0, 0)">
    <rect x="56" y="822" width="1188" height="562" rx="28" fill="rgba(15,20,29,0.82)" stroke="rgba(255,255,255,0.08)" />
    <text x="90" y="858" class="panel-title">Lateral Projection (AP × DV)</text>
    <text x="90" y="882" class="panel-note">Same 302 neurons, second projection for depth-aware layout decisions.</text>
    <polygon points="{lateral_outline}" fill="rgba(114,199,255,0.07)" stroke="rgba(114,199,255,0.20)" stroke-width="2" />
    <text x="102" y="1340" class="axis-label">Head</text>
    <text x="1120" y="1340" class="axis-label" text-anchor="end">Tail</text>
    {''.join(circles_lateral)}
  </g>

  <g>
    <text x="{legend_x}" y="112" class="panel-title">Ganglion Index</text>
    <text x="{legend_x}" y="136" class="panel-note">Color-coded by anatomical ganglion / major body region.</text>
    {''.join(legend_blocks)}
  </g>

  <text x="90" y="1492" class="footer">Primary atlas backbone: Long et al. 2022 (300 neurons). CANL/CANR are affine-projected from the WormNeuroAtlas anatomical atlas into the same frame; atlas fit RMSE = {rmse:.2f}.</text>
  <text x="90" y="1520" class="footer">Connectome context: White et al. 1986 and Cook et al. 2019. NeuroPAL and whole-brain activity papers should be layered next for dynamic state visualization.</text>
</svg>
"""


def build_markdown(entries: List[dict], rmse: float) -> str:
    region_counts: Dict[str, int] = {}
    for entry in entries:
        region_counts[entry["region"]] = region_counts.get(entry["region"], 0) + 1

    region_lines = "\n".join(
        f"- `{region}`: {count} neurons"
        for region, count in sorted(region_counts.items())
    )

    return f"""# C. elegans 302-Neuron Atlas Scaffold

This document accompanies a research-backed anatomical map for **302 hermaphrodite neurons** and a machine-readable atlas file that can be used as the layout layer for future real-time neural visualization in Nema Lab.

## Generated Files

- `docs/research/c-elegans-302-neuron-atlas.svg`
- `src/data/cElegans302Atlas.ts`

## What This Atlas Is

- A **2D visualization scaffold** built from a published whole-body 3D atlas for **300 neurons**.
- The missing **CANL/CANR** positions were added by fitting an affine transform between the WormNeuroAtlas anatomical atlas and the 2022 whole-body atlas, then projecting CANL/CANR into that frame.
- That CAN projection step is an **inference**, not a direct measurement inside the Long et al. atlas.
- Three ganglion labels (**DB7, VA11, RMHR**) were missing from the WormNeuroAtlas ganglion file and were assigned by nearest ganglion centroid. Those assignments are also **inferences**.

## Region Counts

{region_lines}

## Why This Is Useful For The Simulator

You said the next goal is to visualize how external factors affect the worm in real time. This atlas gives you:

1. A stable **node layout** for the 302 neurons.
2. Ganglion and body-region grouping for **visual aggregation**.
3. A code-friendly TypeScript dataset so that simulation state can be projected directly onto neurons.

## Recommended Next Layer For Real-Time Simulation

- Use this atlas as the **anatomical layout layer** only.
- Drive per-neuron color / intensity from a separate **activity state vector**.
- Start with a simplified pipeline:
  - external field -> candidate sensory neurons
  - sensory / interneuron propagation -> command interneurons
  - command interneurons -> motor neuron pools
  - motor pools -> body curvature / trajectory update

That pipeline is a modeling choice. It should be presented as an **interpretive simulator layer**, not as a claim that you have measured all 302 neurons directly.

## Primary Sources

- White JG, Southgate E, Thomson JN, Brenner S. *The structure of the nervous system of the nematode Caenorhabditis elegans*. 1986. https://pmc.ncbi.nlm.nih.gov/articles/PMC2101016/
- Cook SJ, Jarrell TA, Brittin CA, et al. *Whole-animal connectomes of both Caenorhabditis elegans sexes*. 2019. https://www.nature.com/articles/s41586-019-1352-7
- Long F, Peng H, Liu X, Kim SK, Myers E. *Toward a more accurate 3D atlas of C. elegans neurons*. 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC9145532/
- Yemini E, Lin A, Nejatbakhsh A, et al. *NeuroPAL: A Multicolor Atlas for Whole-Brain Neuronal Identification in C. elegans*. 2021. https://pmc.ncbi.nlm.nih.gov/articles/PMC8567154/
- Venkatachalam V, Ji N, Wang X, et al. *Pan-neuronal imaging in roaming Caenorhabditis elegans*. 2016. https://www.pnas.org/doi/10.1073/pnas.1507109113
- Kato S, Kaplan HS, Schrödel T, et al. *Global brain dynamics embed the motor command sequence of Caenorhabditis elegans*. 2015. https://www.cell.com/cell/fulltext/S0092-8674(15)00523-6
- Randi F, Sharma AK, Dvali S, et al. *A signal propagation atlas of C. elegans neurons*. 2023. https://www.nature.com/articles/s41586-023-06683-4

## Data Provenance Notes

- The 300-neuron position backbone comes from the published atlas released with Long et al. 2022 (`bluevex/elegans-atlas`).
- Ganglion membership and the anatomical fallback positions used for CANL/CANR come from the WormNeuroAtlas data package by Randi et al. and collaborators.
- Atlas fit RMSE for the CAN projection step: **{rmse:.2f}**

## Important Caveat

This atlas is excellent for **layout and visualization**, but it is **not yet a full dynamical model** of all 302 neurons. To simulate neural activity credibly, you will still need:

- a stimulus-to-sensory-neuron mapping,
- signed / weighted chemical and gap-junction connectivity,
- a temporal update rule,
- and a muscle / body mechanics readout layer.
"""


def write_typescript(entries: List[dict]) -> None:
    lines = [
        "// Auto-generated by scripts/generate_celegans_atlas.py",
        "// Research-backed anatomical scaffold for future neural visualization.",
        "",
        "export type CElegansGanglion =",
    ]

    for ganglion in GANGLION_ORDER:
        lines.append(f"  | '{ganglion}'")
    lines.extend(
        [
            "",
            "export type CElegansRegion = 'head' | 'pharynx' | 'ventral-nerve-cord' | 'midbody' | 'tail';",
            "",
            "export interface CElegansAtlasNeuron {",
            "  name: string;",
            "  family: string;",
            "  ganglion: CElegansGanglion;",
            "  ganglionSource: 'wormneuroatlas' | 'nearest-ganglion-inference';",
            "  region: CElegansRegion;",
            "  side: 'left' | 'right' | 'midline';",
            "  position3d: { x: number; y: number; z: number };",
            "  projection: { dorsal: { x: number; y: number }; lateral: { x: number; y: number } };",
            "  source: 'bluevex-2022' | 'anatlas-affine-can';",
            "}",
            "",
            "export const cElegansAtlasSourceNotes = {",
        ]
    )
    for key, value in SOURCE_NOTES.items():
        lines.append(f"  '{key}': {json.dumps(value)},")
    lines.extend(
        [
            "} as const;",
            "",
            "export const cElegans302Atlas: CElegansAtlasNeuron[] = ",
            json.dumps(entries, indent=2),
            ";",
            "",
        ]
    )
    (SRC_DATA_DIR / "cElegans302Atlas.ts").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    entries, grouped, rmse = build_entries()
    svg = render_svg(entries, grouped, rmse)
    markdown = build_markdown(entries, rmse)

    (DOCS_DIR / "c-elegans-302-neuron-atlas.svg").write_text(svg, encoding="utf-8")
    (DOCS_DIR / "c-elegans-302-neuron-atlas.md").write_text(markdown, encoding="utf-8")
    write_typescript(entries)

    print("Generated:")
    print(" - docs/research/c-elegans-302-neuron-atlas.svg")
    print(" - docs/research/c-elegans-302-neuron-atlas.md")
    print(" - src/data/cElegans302Atlas.ts")


if __name__ == "__main__":
    main()
