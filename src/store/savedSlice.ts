// ============================================================================
// Zustand Store — Saved Slice
// Persisted saved experiment runs (localStorage, max 24).
// ============================================================================

import type { StateCreator } from 'zustand';
import type { SimConfig, Metrics } from '../engine/types';
import { deepClone } from '../engine/math';

export interface SavedRun {
  id: string;
  name: string;
  config: SimConfig;
  seed: string;
  createdAt: number;
  metrics: Metrics | null;
}

export interface SavedSlice {
  savedRuns: SavedRun[];
  loadSavedRuns: () => void;
  saveRun: (name: string, config: SimConfig, seed: string, metrics: Metrics | null) => void;
  deleteRun: (id: string) => void;
  clearAllRuns: () => void;
}

const STORAGE_KEY = 'nema-lab-saves-v3';
const MAX_SAVED = 24;

export const createSavedSlice: StateCreator<SavedSlice, [], [], SavedSlice> = (set, _get) => ({
  savedRuns: [],

  loadSavedRuns: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ savedRuns: parsed });
        }
      }
    } catch (error) {
      console.warn('Failed to load saved runs', error);
    }
  },

  saveRun: (name, config, seed, metrics) => {
    const entry: SavedRun = {
      id: `save-${Date.now()}`,
      name,
      config: deepClone(config),
      seed,
      createdAt: Date.now(),
      metrics,
    };
    set((state) => {
      const runs = [entry, ...state.savedRuns].slice(0, MAX_SAVED);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
      } catch (error) {
        console.warn('Failed to persist saved runs', error);
      }
      return { savedRuns: runs };
    });
  },

  deleteRun: (id) => {
    set((state) => {
      const runs = state.savedRuns.filter((r) => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
      } catch (error) {
        console.warn('Failed to persist saved runs', error);
      }
      return { savedRuns: runs };
    });
  },

  clearAllRuns: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear saved runs', error);
    }
    set({ savedRuns: [] });
  },
});
