// ============================================================================
// Zustand Store — Settings Slice
// User preferences persisted to localStorage.
// ============================================================================

import type { StateCreator } from 'zustand';

export interface Settings {
  highContrast: boolean;
  reducedMotion: boolean;
  showOnboarding: boolean;
  compareDefaultLayout: '2x1' | '2x2';
  language: 'ko' | 'en';
}

export interface SettingsSlice {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  loadSettings: () => void;
  persistSettings: () => void;
}

const STORAGE_KEY = 'nema-lab-settings-v3';

const DEFAULT_SETTINGS: Settings = {
  highContrast: false,
  reducedMotion: false,
  showOnboarding: true,
  compareDefaultLayout: '2x1',
  language: 'ko',
};

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  settings: { ...DEFAULT_SETTINGS },

  updateSetting: (key, value) => {
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
    get().persistSettings();
  },

  loadSettings: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        set((state) => ({
          settings: { ...state.settings, ...parsed },
        }));
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage', error);
    }
  },

  persistSettings: () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().settings));
    } catch (error) {
      console.warn('Failed to persist settings', error);
    }
  },
});
