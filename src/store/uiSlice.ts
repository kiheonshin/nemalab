// ============================================================================
// Zustand Store — UI Slice
// Transient UI state: current view, toast messages, drawer state.
// ============================================================================

import type { StateCreator } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  createdAt: number;
}

export interface UISlice {
  currentView: string;
  toasts: ToastMessage[];
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  trackingMode: boolean;

  setCurrentView: (view: string) => void;
  showToast: (message: string) => void;
  dismissToast: (id: string) => void;
  toggleLeftDrawer: () => void;
  toggleRightDrawer: () => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setRightDrawerOpen: (open: boolean) => void;
  setTrackingMode: (enabled: boolean) => void;
}

let toastCounter = 0;

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  currentView: 'lab',
  toasts: [],
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  trackingMode: false,

  setCurrentView: (view) => set({ currentView: view }),

  showToast: (message) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, createdAt: Date.now() }],
    }));
    // Auto-dismiss after 2.6s
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 2600);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  toggleLeftDrawer: () =>
    set((state) => ({ leftDrawerOpen: !state.leftDrawerOpen })),

  toggleRightDrawer: () =>
    set((state) => ({ rightDrawerOpen: !state.rightDrawerOpen })),

  setLeftDrawerOpen: (open) => set({ leftDrawerOpen: open }),
  setRightDrawerOpen: (open) => set({ rightDrawerOpen: open }),
  setTrackingMode: (enabled) => set({ trackingMode: enabled }),
});
