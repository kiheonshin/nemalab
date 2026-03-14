// ============================================================================
// Nema Lab — IndexedDB Storage: Settings Store
//
// Singleton settings record (key = 'user').
// Replaces localStorage 'nema-lab-settings-v3'.
// ============================================================================

import type { SettingsRecord } from './schema';
import { STORES, DEFAULT_SETTINGS } from './schema';
import { readTx, writeTx } from './db';

/**
 * Get the current settings, returning defaults if none saved.
 */
export async function getSettings(): Promise<SettingsRecord> {
  const result = await readTx<SettingsRecord | undefined>(STORES.SETTINGS, (store) =>
    store.get('user'),
  );
  return result ?? { ...DEFAULT_SETTINGS };
}

/**
 * Save settings (creates or overwrites the singleton record).
 */
export async function saveSettings(settings: Partial<SettingsRecord>): Promise<void> {
  const current = await getSettings();
  const merged: SettingsRecord = { ...current, ...settings, key: 'user' };
  await writeTx(STORES.SETTINGS, (store) => store.put(merged));
}

/**
 * Reset settings to defaults.
 */
export async function resetSettings(): Promise<void> {
  await writeTx(STORES.SETTINGS, (store) => store.put({ ...DEFAULT_SETTINGS }));
}
