// ============================================================================
// Nema Lab — IndexedDB Storage: Last Lab State Store
//
// Singleton record for session restore (key = 'current').
// Replaces localStorage 'nema-lab-last-lab-v3'.
// ============================================================================

import type { LastLabRecord } from './schema';
import { STORES } from './schema';
import { readTx, writeTx } from './db';

/**
 * Get the last lab state, returning null if none exists.
 */
export async function getLastLab(): Promise<LastLabRecord | null> {
  const result = await readTx<LastLabRecord | undefined>(STORES.LAST_LAB, (store) =>
    store.get('current'),
  );
  return result ?? null;
}

/**
 * Save the current lab state for session restore.
 */
export async function saveLastLab(record: Omit<LastLabRecord, 'key'>): Promise<void> {
  const full: LastLabRecord = {
    ...record,
    key: 'current',
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
  await writeTx(STORES.LAST_LAB, (store) => store.put(full));
}

/**
 * Clear the last lab state.
 */
export async function clearLastLab(): Promise<void> {
  await writeTx(STORES.LAST_LAB, (store) => store.delete('current'));
}
