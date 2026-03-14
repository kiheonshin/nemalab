# C. elegans 302-Neuron Atlas Scaffold

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

- `head`: 169 neurons
- `midbody`: 16 neurons
- `pharynx`: 20 neurons
- `tail`: 41 neurons
- `ventral-nerve-cord`: 56 neurons

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
- Atlas fit RMSE for the CAN projection step: **10.20**

## Important Caveat

This atlas is excellent for **layout and visualization**, but it is **not yet a full dynamical model** of all 302 neurons. To simulate neural activity credibly, you will still need:

- a stimulus-to-sensory-neuron mapping,
- signed / weighted chemical and gap-junction connectivity,
- a temporal update rule,
- and a muscle / body mechanics readout layer.
