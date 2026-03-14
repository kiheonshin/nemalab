// ============================================================================
// Nema Lab — IndexedDB Storage: localStorage Migration
//
// One-time migration from the original app.js localStorage keys to IndexedDB.
// After migration, sets a flag to avoid re-running.
// ============================================================================

import type { SimConfig } from '../engine/types';
import type { SavedRun, SettingsRecord } from './schema';
import { DEFAULT_SETTINGS } from './schema';
import { addSavedRun } from './savedRunsStore';
import { saveSettings } from './settingsStore';
import { saveLastLab } from './lastLabStore';

const MIGRATION_FLAG = 'nema-lab-idb-migrated';

// Original localStorage keys from app.js
const LS_KEYS = {
  saves: 'nema-lab-saves-v3',
  settings: 'nema-lab-settings-v3',
  lastLab: 'nema-lab-last-lab-v3',
};

/**
 * Check if migration is needed and perform it.
 * Safe to call multiple times; no-op after first successful migration.
 */
export async function migrateFromLocalStorage(): Promise<{
  migrated: boolean;
  runsImported: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let runsImported = 0;

  // Skip if already migrated
  if (typeof localStorage === 'undefined') {
    return { migrated: false, runsImported: 0, errors: ['localStorage not available'] };
  }

  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return { migrated: false, runsImported: 0, errors: [] };
  }

  // --- Migrate saved runs ---
  try {
    const rawSaves = localStorage.getItem(LS_KEYS.saves);
    if (rawSaves) {
      const saves = JSON.parse(rawSaves) as Array<{
        name?: string;
        seed?: string;
        config?: SimConfig;
        snapshot?: Record<string, unknown>;
        metrics?: Record<string, unknown>;
        ts?: string;
      }>;

      for (const save of saves) {
        try {
          const run: Omit<SavedRun, 'id'> = {
            name: save.name || `Run ${runsImported + 1}`,
            note: '',
            savedAt: save.ts || new Date().toISOString(),
            seed: save.seed || '',
            config: save.config as SimConfig,
            snapshot: save.snapshot as unknown as SavedRun['snapshot'],
            metrics: save.metrics as unknown as SavedRun['metrics'],
            world: (save as Record<string, unknown>).world as SavedRun['world'],
            recentEvents: [],
            tags: [],
          };
          await addSavedRun(run);
          runsImported++;
        } catch (e) {
          errors.push(`Failed to migrate run "${save.name}": ${String(e)}`);
        }
      }
    }
  } catch (e) {
    errors.push(`Failed to parse saved runs: ${String(e)}`);
  }

  // --- Migrate settings ---
  try {
    const rawSettings = localStorage.getItem(LS_KEYS.settings);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings) as Partial<SettingsRecord>;
      await saveSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
        key: 'user',
      });
    }
  } catch (e) {
    errors.push(`Failed to migrate settings: ${String(e)}`);
  }

  // --- Migrate last lab ---
  try {
    const rawLastLab = localStorage.getItem(LS_KEYS.lastLab);
    if (rawLastLab) {
      const parsed = JSON.parse(rawLastLab) as { config?: SimConfig; seed?: string };
      if (parsed.config) {
        await saveLastLab({
          config: parsed.config,
          seed: parsed.seed || '',
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    errors.push(`Failed to migrate last lab: ${String(e)}`);
  }

  // Mark migration complete
  try {
    localStorage.setItem(MIGRATION_FLAG, 'true');
  } catch {
    // Non-critical; worst case we re-migrate (idempotent via addSavedRun)
  }

  return { migrated: true, runsImported, errors };
}
