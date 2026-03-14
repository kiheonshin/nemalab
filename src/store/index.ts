// ============================================================================
// Zustand Store — Combined Store
// All slices merged into a single store with selectors.
// ============================================================================

import { create } from 'zustand';
import { createLabSlice, type LabSlice } from './labSlice';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice';
import { createUISlice, type UISlice } from './uiSlice';
import { createSimulationSlice, type SimulationSlice } from './simulationSlice';
import { createSavedSlice, type SavedSlice } from './savedSlice';
import { createCompareSlice, type CompareSlice } from './compareSlice';

export type AppStore = LabSlice & SettingsSlice & UISlice & SimulationSlice & SavedSlice & CompareSlice;

export const useStore = create<AppStore>()((...args) => ({
  ...createLabSlice(...args),
  ...createSettingsSlice(...args),
  ...createUISlice(...args),
  ...createSimulationSlice(...args),
  ...createSavedSlice(...args),
  ...createCompareSlice(...args),
}));

// --- Typed selectors (convenience) ---
export const useLab = () => useStore((s) => ({
  appliedConfig: s.appliedConfig,
  draftConfig: s.draftConfig,
  dirtyPaths: s.dirtyPaths,
  running: s.running,
  timeScale: s.timeScale,
  seedLocked: s.seedLocked,
  appliedSeed: s.appliedSeed,
  draftSeed: s.draftSeed,
}));

export const useSettings = () => useStore((s) => s.settings);

export const useUI = () => useStore((s) => ({
  currentView: s.currentView,
  toasts: s.toasts,
  leftDrawerOpen: s.leftDrawerOpen,
  rightDrawerOpen: s.rightDrawerOpen,
}));

export const useSimulation = () => useStore((s) => ({
  simInstance: s.simInstance,
  snapshot: s.snapshot,
  simRunning: s.simRunning,
}));

export const useSaved = () => useStore((s) => s.savedRuns);

export const useCompare = () => useStore((s) => ({
  baselineConfig: s.baselineConfig,
  variantApplied: s.variantApplied,
  variantDraft: s.variantDraft,
  compareDirtyPaths: s.compareDirtyPaths,
  compareRunning: s.compareRunning,
  compareTimeScale: s.compareTimeScale,
  compareSeed: s.compareSeed,
  compareLayout: s.compareLayout,
  simA: s.simA,
  simB: s.simB,
  snapshotA: s.snapshotA,
  snapshotB: s.snapshotB,
}));

// Re-export slices for testing
export type { LabSlice } from './labSlice';
export type { SettingsSlice } from './settingsSlice';
export type { UISlice } from './uiSlice';
export type { SimulationSlice } from './simulationSlice';
export type { SavedSlice, SavedRun } from './savedSlice';
export type { CompareSlice } from './compareSlice';
