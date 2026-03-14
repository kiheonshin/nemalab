// ============================================================================
// Zustand Store — Simulation Slice
// Manages the WormSimulation engine instance and animation loop state.
// ============================================================================

import type { StateCreator } from 'zustand';
import type { Snapshot } from '../engine/types';
import { WormSimulation } from '../engine/WormSimulation';

export interface SimulationSlice {
  /** The active engine instance (null before first creation). */
  simInstance: WormSimulation | null;
  /** Latest snapshot for UI rendering. */
  snapshot: Snapshot | null;
  /** Whether the sim loop is running. */
  simRunning: boolean;

  createSimulation: (config: import('../engine/types').SimConfig, seed: string) => void;
  destroySimulation: () => void;
  stepSimulation: (dt: number) => void;
  updateSnapshot: () => void;
  setSimRunning: (running: boolean) => void;
  resetSimulation: () => void;
}

export const createSimulationSlice: StateCreator<SimulationSlice, [], [], SimulationSlice> = (set, get) => ({
  simInstance: null,
  snapshot: null,
  simRunning: true,

  createSimulation: (config, seed) => {
    const sim = new WormSimulation(config, seed);
    set({
      simInstance: sim,
      snapshot: sim.getSnapshot(),
      simRunning: true,
    });
  },

  destroySimulation: () => {
    set({ simInstance: null, snapshot: null, simRunning: false });
  },

  stepSimulation: (dt) => {
    const sim = get().simInstance;
    if (!sim) return;
    sim.step(dt);
    set({ snapshot: sim.getSnapshot() });
  },

  updateSnapshot: () => {
    const sim = get().simInstance;
    if (!sim) return;
    set({ snapshot: sim.getSnapshot() });
  },

  setSimRunning: (running) => set({ simRunning: running }),

  resetSimulation: () => {
    const sim = get().simInstance;
    if (!sim) return;
    sim.reset(true);
    set({ snapshot: sim.getSnapshot() });
  },
});
