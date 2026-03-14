// ============================================================================
// Nema Lab — IndexedDB Storage Layer: Database Connection & Migration
//
// Provides a promise-based wrapper around IndexedDB for:
// - saved-runs (replaces localStorage nema-lab-saves-v3)
// - settings (replaces localStorage nema-lab-settings-v3)
// - last-lab (replaces localStorage nema-lab-last-lab-v3)
//
// Design decisions:
// - Single database with 3 object stores
// - Promise-based API (no callback hell)
// - Auto-migration from localStorage on first open (one-time)
// - Version-based schema upgrades via onupgradeneeded
// ============================================================================

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  SAVED_RUNS_INDEXES,
} from './schema';

// ---------------------------------------------------------------------------
// Singleton connection
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open (or return cached) database connection.
 * Creates object stores and indexes on first open or version upgrade.
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // --- saved-runs store ---
      if (!db.objectStoreNames.contains(STORES.SAVED_RUNS)) {
        const runsStore = db.createObjectStore(STORES.SAVED_RUNS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        for (const idx of SAVED_RUNS_INDEXES) {
          runsStore.createIndex(idx.name, idx.keyPath, idx.options);
        }
      }

      // --- settings store (singleton by key) ---
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // --- last-lab store (singleton by key) ---
      if (!db.objectStoreNames.contains(STORES.LAST_LAB)) {
        db.createObjectStore(STORES.LAST_LAB, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(new StorageError('Failed to open IndexedDB', request.error));
    };
  });

  return dbPromise;
}

/**
 * Close the database and clear the cached connection.
 * Useful for tests and cleanup.
 */
export function closeDB(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
}

// ---------------------------------------------------------------------------
// Generic transaction helpers
// ---------------------------------------------------------------------------

/**
 * Execute a read-only transaction on a single store.
 */
export async function readTx<T>(
  storeName: string,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError('Read transaction failed', request.error));
  });
}

/**
 * Execute a readwrite transaction on a single store.
 */
export async function writeTx<T>(
  storeName: string,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError('Write transaction failed', request.error));
  });
}

/**
 * Execute a readwrite transaction and return all results via getAll.
 */
export async function readAllTx<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new StorageError('ReadAll transaction failed', request.error));
  });
}

// ---------------------------------------------------------------------------
// Custom Error
// ---------------------------------------------------------------------------

export class StorageError extends Error {
  cause: DOMException | null;

  constructor(message: string, cause?: DOMException | null) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause ?? null;
  }
}
