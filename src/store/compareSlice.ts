// ============================================================================
// Zustand Store — Compare Slice
// Compare view state: baseline + variant configs, side-by-side sims.
// Manages two WormSimulation instances (simA, simB) that step synchronously.
// ============================================================================

import type { StateCreator } from 'zustand';
import type { SimConfig, Snapshot, Metrics } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/constants';
import { deepClone } from '../engine/math';
import { randomSeed } from '../engine/rng';
import { WormSimulation } from '../engine/WormSimulation';

export interface CompareSlice {
  baselineConfig: SimConfig;
  variantApplied: SimConfig;
  variantDraft: SimConfig;
  compareDirtyPaths: Set<string>;
  compareRunning: boolean;
  compareTimeScale: number;
  compareSeedLocked: boolean;
  compareSeed: string;
  compareLayout: '2x1' | '2x2';

  /** Simulation instance for the baseline (A) stage. */
  simA: WormSimulation | null;
  /** Simulation instance for the variant (B) stage. */
  simB: WormSimulation | null;
  /** Latest snapshot for stage A. */
  snapshotA: Snapshot | null;
  /** Latest snapshot for stage B. */
  snapshotB: Snapshot | null;

  setBaselineConfig: (config: SimConfig) => void;
  setVariantDraftValue: (path: string, value: unknown) => void;
  applyVariant: () => void;
  setCompareRunning: (running: boolean) => void;
  setCompareTimeScale: (scale: number) => void;
  setCompareSeed: (seed: string) => void;
  setCompareLayout: (layout: '2x1' | '2x2') => void;
  syncFromLab: (config: SimConfig) => void;

  /** Create both simulation instances with current configs and seed. */
  initCompareSimulations: () => void;
  /** Synchronously step both simulations by the same dt. */
  stepCompare: (dt: number) => void;
  /** Reset both simulations (regenerate world). */
  resetCompare: () => void;
  /** Compute the delta between the two snapshots' metrics. */
  getMetricsDelta: () => Record<string, number> | null;
}

export const createCompareSlice: StateCreator<CompareSlice, [], [], CompareSlice> = (set, get) => ({
  baselineConfig: deepClone(DEFAULT_CONFIG) as SimConfig,
  variantApplied: deepClone(DEFAULT_CONFIG) as SimConfig,
  variantDraft: deepClone(DEFAULT_CONFIG) as SimConfig,
  compareDirtyPaths: new Set<string>(),
  compareRunning: true,
  compareTimeScale: 1,
  compareSeedLocked: true,
  compareSeed: randomSeed(),
  compareLayout: '2x1',

  simA: null,
  simB: null,
  snapshotA: null,
  snapshotB: null,

  setBaselineConfig: (config) =>
    set({ baselineConfig: deepClone(config) }),

  setVariantDraftValue: (path, value) => {
    set((state) => {
      const draft = deepClone(state.variantDraft) as unknown as Record<string, unknown>;
      const parts = path.split('.');
      const last = parts.pop()!;
      let cursor: Record<string, unknown> = draft;
      parts.forEach((part) => {
        if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
        cursor = cursor[part] as Record<string, unknown>;
      });
      cursor[last] = value;

      const newDirty = new Set(state.compareDirtyPaths);
      newDirty.add(path);

      return {
        variantDraft: draft as unknown as SimConfig,
        compareDirtyPaths: newDirty,
      };
    });
  },

  applyVariant: () => {
    set((state) => ({
      variantApplied: deepClone(state.variantDraft),
      compareDirtyPaths: new Set<string>(),
    }));
    // Rebuild simB with the new variant config
    const state = get();
    if (state.simB) {
      state.simB.setConfig(state.variantApplied, true);
      if (state.simB.getSeed() !== state.compareSeed) {
        state.simB.setSeed(state.compareSeed);
      }
      set({ snapshotB: state.simB.getSnapshot() });
    }
  },

  setCompareRunning: (running) => set({ compareRunning: running }),
  setCompareTimeScale: (scale) => set({ compareTimeScale: scale }),

  setCompareSeed: (seed) => {
    set({ compareSeed: seed });
    const state = get();
    if (state.simA) {
      state.simA.setSeed(seed);
      set({ snapshotA: state.simA.getSnapshot() });
    }
    if (state.simB) {
      state.simB.setSeed(seed);
      set({ snapshotB: state.simB.getSnapshot() });
    }
  },

  setCompareLayout: (layout) => set({ compareLayout: layout }),

  syncFromLab: (config) => {
    set({
      baselineConfig: deepClone(config),
      variantApplied: deepClone(config),
      variantDraft: deepClone(config),
      compareDirtyPaths: new Set<string>(),
    });
  },

  initCompareSimulations: () => {
    const state = get();
    const seed = state.compareSeed;
    const simA = new WormSimulation(state.baselineConfig, seed);
    const simB = new WormSimulation(state.variantApplied, seed);
    set({
      simA,
      simB,
      snapshotA: simA.getSnapshot(),
      snapshotB: simB.getSnapshot(),
    });
  },

  stepCompare: (dt) => {
    const { simA, simB } = get();
    if (!simA || !simB) return;
    simA.step(dt);
    simB.step(dt);
    set({
      snapshotA: simA.getSnapshot(),
      snapshotB: simB.getSnapshot(),
    });
  },

  resetCompare: () => {
    const { simA, simB } = get();
    if (simA) {
      simA.reset(true);
      set({ snapshotA: simA.getSnapshot() });
    }
    if (simB) {
      simB.reset(true);
      set({ snapshotB: simB.getSnapshot() });
    }
  },

  getMetricsDelta: () => {
    const { snapshotA, snapshotB } = get();
    if (!snapshotA || !snapshotB) return null;
    const mA: Metrics = snapshotA.metrics;
    const mB: Metrics = snapshotB.metrics;
    return {
      elapsed: mB.elapsed - mA.elapsed,
      distance: mB.distance - mA.distance,
      collisions: mB.collisions - mA.collisions,
      turns: mB.turns - mA.turns,
      reversals: mB.reversals - mA.reversals,
      foodTime: mB.foodTime - mA.foodTime,
      avgChemo: mB.avgChemo - mA.avgChemo,
      avgTempError: mB.avgTempError - mA.avgTempError,
    };
  },
});
