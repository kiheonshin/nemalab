// ============================================================================
// Zustand Store — Lab Slice
// Manages Lab view state: draft/applied config, dirty tracking, simulation.
// ============================================================================

import type { StateCreator } from 'zustand';
import type { SimConfig } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/constants';
import { deepClone, getByPath } from '../engine/math';
import { randomSeed } from '../engine/rng';

export interface LabSlice {
  // --- Config state ---
  appliedConfig: SimConfig;
  draftConfig: SimConfig;
  dirtyPaths: Set<string>;
  visualDirtyPaths: Set<string>;

  // --- Simulation control ---
  running: boolean;
  timeScale: number;

  // --- Seed ---
  seedLocked: boolean;
  appliedSeed: string;
  draftSeed: string;

  // --- Visual feedback ---
  visualFeedbackUntil: number;

  // --- Actions ---
  setDraftValue: (path: string, value: unknown) => void;
  applySection: (section: string) => void;
  applyAll: () => void;
  resetConfig: () => void;
  setRunning: (running: boolean) => void;
  setTimeScale: (scale: number) => void;
  setSeedLocked: (locked: boolean) => void;
  setDraftSeed: (seed: string) => void;
  regenerateSeed: () => void;
  resetRun: () => void;
}

/** Section name -> path prefix matcher */
const SECTION_RULES: Record<string, (path: string) => boolean> = {
  sensors: (p) => p.startsWith('sensors.'),
  worm: (p) => p.startsWith('worm.'),
  behavior: (p) => p.startsWith('behavior.'),
  environment: (p) => p.startsWith('world.'),
  visuals: (p) => p.startsWith('visuals.'),
  seed: (p) => p === 'seed',
};

export const createLabSlice: StateCreator<LabSlice, [], [], LabSlice> = (set, get) => ({
  appliedConfig: deepClone(DEFAULT_CONFIG) as SimConfig,
  draftConfig: deepClone(DEFAULT_CONFIG) as SimConfig,
  dirtyPaths: new Set<string>(),
  visualDirtyPaths: new Set<string>(),
  running: true,
  timeScale: 1,
  seedLocked: true,
  appliedSeed: randomSeed(),
  draftSeed: '',
  visualFeedbackUntil: 0,

  setDraftValue: (path, value) => {
    set((state) => {
      const draft = deepClone(state.draftConfig) as unknown as Record<string, unknown>;
      const parts = path.split('.');
      const last = parts.pop()!;
      let cursor: Record<string, unknown> = draft;
      parts.forEach((part) => {
        if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
        cursor = cursor[part] as Record<string, unknown>;
      });
      cursor[last] = value;

      const newDirty = new Set(state.dirtyPaths);
      const appliedVal = getByPath(state.appliedConfig as unknown as Record<string, unknown>, path);
      if (JSON.stringify(appliedVal) !== JSON.stringify(value)) {
        newDirty.add(path);
      } else {
        newDirty.delete(path);
      }

      const isVisual = path.startsWith('visuals.');
      const newVisualDirty = new Set(state.visualDirtyPaths);
      if (isVisual) {
        if (JSON.stringify(appliedVal) !== JSON.stringify(value)) {
          newVisualDirty.add(path);
        } else {
          newVisualDirty.delete(path);
        }
      }

      return {
        draftConfig: draft as unknown as SimConfig,
        dirtyPaths: newDirty,
        visualDirtyPaths: newVisualDirty,
      };
    });
  },

  applySection: (section) => {
    set((state) => {
      const matcher = SECTION_RULES[section];
      if (!matcher) return state;

      const newApplied = deepClone(state.appliedConfig) as unknown as Record<string, unknown>;
      const draftObj = state.draftConfig as unknown as Record<string, unknown>;
      const newDirty = new Set(state.dirtyPaths);

      for (const path of state.dirtyPaths) {
        if (matcher(path)) {
          const val = getByPath(draftObj, path);
          const parts = path.split('.');
          const last = parts.pop()!;
          let cursor: Record<string, unknown> = newApplied;
          parts.forEach((part) => {
            if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
            cursor = cursor[part] as Record<string, unknown>;
          });
          cursor[last] = val;
          newDirty.delete(path);
        }
      }

      // Handle seed section
      if (section === 'seed') {
        newDirty.delete('seed');
        return {
          appliedConfig: newApplied as unknown as SimConfig,
          appliedSeed: state.draftSeed || state.appliedSeed,
          dirtyPaths: newDirty,
          visualFeedbackUntil: Date.now() + 800,
        };
      }

      return {
        appliedConfig: newApplied as unknown as SimConfig,
        dirtyPaths: newDirty,
        visualFeedbackUntil: Date.now() + 800,
      };
    });
  },

  applyAll: () => {
    set((state) => ({
      appliedConfig: deepClone(state.draftConfig),
      appliedSeed: state.draftSeed || state.appliedSeed,
      dirtyPaths: new Set<string>(),
      visualDirtyPaths: new Set<string>(),
      visualFeedbackUntil: Date.now() + 800,
    }));
  },

  resetConfig: () => {
    const newSeed = randomSeed();
    set({
      appliedConfig: deepClone(DEFAULT_CONFIG) as SimConfig,
      draftConfig: deepClone(DEFAULT_CONFIG) as SimConfig,
      dirtyPaths: new Set<string>(),
      visualDirtyPaths: new Set<string>(),
      appliedSeed: newSeed,
      draftSeed: newSeed,
    });
  },

  setRunning: (running) => set({ running }),

  setTimeScale: (scale) => set({ timeScale: scale }),

  setSeedLocked: (locked) => set({ seedLocked: locked }),

  setDraftSeed: (seed) => {
    set((state) => {
      const newDirty = new Set(state.dirtyPaths);
      if (seed !== state.appliedSeed) {
        newDirty.add('seed');
      } else {
        newDirty.delete('seed');
      }
      return { draftSeed: seed, dirtyPaths: newDirty };
    });
  },

  regenerateSeed: () => {
    const seed = randomSeed();
    get().setDraftSeed(seed);
  },

  resetRun: () => {
    set((state) => {
      if (!state.seedLocked) {
        const newSeed = randomSeed();
        const newDirty = new Set(state.dirtyPaths);
        newDirty.delete('seed');
        return { appliedSeed: newSeed, draftSeed: newSeed, dirtyPaths: newDirty };
      }
      return {};
    });
  },
});
