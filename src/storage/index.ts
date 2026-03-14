// ============================================================================
// Nema Lab — IndexedDB Storage Layer: Barrel Export
// ============================================================================

// --- Database connection ---
export { openDB, closeDB, StorageError } from './db';

// --- Schema & types ---
export type { SavedRun, SettingsRecord, LastLabRecord } from './schema';
export { DB_NAME, DB_VERSION, STORES, MAX_SAVED_RUNS, DEFAULT_SETTINGS } from './schema';

// --- Saved runs CRUD ---
export {
  getAllSavedRuns,
  getSavedRun,
  getSavedRunCount,
  addSavedRun,
  updateSavedRun,
  deleteSavedRun,
  clearAllSavedRuns,
  findRunsBySeed,
  findRunsByPreset,
} from './savedRunsStore';

// --- Settings ---
export { getSettings, saveSettings, resetSettings } from './settingsStore';

// --- Last lab state ---
export { getLastLab, saveLastLab, clearLastLab } from './lastLabStore';

// --- Migration ---
export { migrateFromLocalStorage } from './migration';
