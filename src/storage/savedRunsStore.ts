// ============================================================================
// Nema Lab — IndexedDB Storage: Saved Runs Store
//
// CRUD operations for saved simulation runs.
// Replaces the localStorage-based save system in the original app.js.
// ============================================================================

import type { SavedRun } from './schema';
import { STORES, MAX_SAVED_RUNS } from './schema';
import { readTx, writeTx, readAllTx, StorageError } from './db';

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/**
 * Get all saved runs, sorted by savedAt descending (newest first).
 */
export async function getAllSavedRuns(): Promise<SavedRun[]> {
  const runs = await readAllTx<SavedRun>(STORES.SAVED_RUNS);
  return runs.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Get a single saved run by its auto-increment ID.
 */
export async function getSavedRun(id: number): Promise<SavedRun | undefined> {
  return readTx<SavedRun | undefined>(STORES.SAVED_RUNS, (store) => store.get(id));
}

/**
 * Get the total count of saved runs.
 */
export async function getSavedRunCount(): Promise<number> {
  return readTx<number>(STORES.SAVED_RUNS, (store) => store.count());
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/**
 * Save a new run. Enforces the MAX_SAVED_RUNS limit by rejecting if full.
 * Returns the auto-generated ID.
 */
export async function addSavedRun(run: Omit<SavedRun, 'id'>): Promise<number> {
  const count = await getSavedRunCount();
  if (count >= MAX_SAVED_RUNS) {
    throw new StorageError(
      `Cannot save: maximum of ${MAX_SAVED_RUNS} saved runs reached. Delete some runs first.`,
    );
  }

  const record: SavedRun = {
    ...run,
    savedAt: run.savedAt || new Date().toISOString(),
    tags: run.tags || [],
    note: run.note || '',
  };

  const id = await writeTx<IDBValidKey>(STORES.SAVED_RUNS, (store) => store.add(record));
  return id as number;
}

/**
 * Update an existing saved run (e.g. rename, add note).
 */
export async function updateSavedRun(run: SavedRun): Promise<void> {
  if (run.id == null) {
    throw new StorageError('Cannot update a run without an ID');
  }
  await writeTx(STORES.SAVED_RUNS, (store) => store.put(run));
}

/**
 * Delete a saved run by ID.
 */
export async function deleteSavedRun(id: number): Promise<void> {
  await writeTx(STORES.SAVED_RUNS, (store) => store.delete(id));
}

/**
 * Delete all saved runs (clear the store).
 */
export async function clearAllSavedRuns(): Promise<void> {
  await writeTx(STORES.SAVED_RUNS, (store) => store.clear());
}

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

/**
 * Find saved runs by seed value.
 */
export async function findRunsBySeed(seed: string): Promise<SavedRun[]> {
  const all = await getAllSavedRuns();
  return all.filter((run) => run.seed === seed);
}

/**
 * Find saved runs by preset name.
 */
export async function findRunsByPreset(presetName: string): Promise<SavedRun[]> {
  const all = await getAllSavedRuns();
  return all.filter((run) => run.config.presetName === presetName);
}
