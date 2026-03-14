// ============================================================================
// Nema Lab — IndexedDB Storage Layer: Schema Definition
// ============================================================================

import type { SimConfig, Snapshot, Metrics, World, SimEvent } from '../engine/types';

// ---------------------------------------------------------------------------
// Database Constants
// ---------------------------------------------------------------------------

export const DB_NAME = 'nema-lab';
export const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Object Store Names
// ---------------------------------------------------------------------------

export const STORES = {
  /** Saved simulation runs (replaces localStorage 'nema-lab-saves-v3'). */
  SAVED_RUNS: 'saved-runs',
  /** User settings (replaces localStorage 'nema-lab-settings-v3'). */
  SETTINGS: 'settings',
  /** Last lab state for session restore (replaces localStorage 'nema-lab-last-lab-v3'). */
  LAST_LAB: 'last-lab',
} as const;

// ---------------------------------------------------------------------------
// Saved Run Record
// ---------------------------------------------------------------------------

export interface SavedRun {
  /** Auto-increment primary key. */
  id?: number;
  /** User-assigned name (defaults to preset name + seed). */
  name: string;
  /** Optional user note / memo (F27 future). */
  note: string;
  /** ISO 8601 timestamp of when the run was saved. */
  savedAt: string;
  /** Seed used for the run. */
  seed: string;
  /** Full config at save time. */
  config: SimConfig;
  /** Snapshot at save time (position, sensor, metrics, events). */
  snapshot: Snapshot;
  /** Derived metrics at save time. */
  metrics: Metrics;
  /** World state for thumbnail rendering. */
  world: World;
  /** Recent events for review. */
  recentEvents: SimEvent[];
  /** Optional tags for filtering. */
  tags: string[];
}

// ---------------------------------------------------------------------------
// Settings Record (singleton row, key = 'user')
// ---------------------------------------------------------------------------

export interface SettingsRecord {
  /** Fixed key: 'user'. */
  key: 'user';
  /** UI language code. */
  language: 'ko' | 'en';
  /** Theme preference. */
  theme: 'dark' | 'light' | 'system';
  /** Show onboarding on next launch. */
  showOnboarding: boolean;
  /** Accessibility: reduced motion. */
  reducedMotion: boolean;
  /** Default time scale. */
  defaultTimeScale: number;
}

// ---------------------------------------------------------------------------
// Last Lab State (singleton row, key = 'current')
// ---------------------------------------------------------------------------

export interface LastLabRecord {
  /** Fixed key: 'current'. */
  key: 'current';
  /** Config being edited (may include unsaved draft changes). */
  config: SimConfig;
  /** Seed being used. */
  seed: string;
  /** Timestamp of last save. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Default Values
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: SettingsRecord = {
  key: 'user',
  language: 'ko',
  theme: 'dark',
  showOnboarding: true,
  reducedMotion: false,
  defaultTimeScale: 1,
};

// ---------------------------------------------------------------------------
// Index Definitions (for schema creation)
// ---------------------------------------------------------------------------

export interface IndexDef {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

export const SAVED_RUNS_INDEXES: IndexDef[] = [
  { name: 'by-savedAt', keyPath: 'savedAt', options: { unique: false } },
  { name: 'by-seed', keyPath: 'seed', options: { unique: false } },
  { name: 'by-name', keyPath: 'name', options: { unique: false } },
  { name: 'by-preset', keyPath: 'config.presetName', options: { unique: false } },
];

/** Maximum number of saved runs allowed. */
export const MAX_SAVED_RUNS = 24;
