// ============================================================================
// useKeyboardShortcuts — Global keyboard shortcuts for Lab simulation control
// Space: play/pause | S: step | R: reset
// Disabled when focus is inside text inputs.
// ============================================================================

import { useEffect } from 'react';
import { useStore } from '../store';

/** Returns true when the active element is a text-input context. */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;

      const key = e.key.toLowerCase();

      if (key === ' ') {
        e.preventDefault();
        const { running, setRunning } = useStore.getState();
        setRunning(!running);
        return;
      }

      if (key === 's') {
        e.preventDefault();
        const { setRunning, stepSimulation } = useStore.getState();
        setRunning(false);
        stepSimulation(1 / 60);
        return;
      }

      if (key === 'r') {
        e.preventDefault();
        const { resetRun, resetSimulation, showToast } = useStore.getState();
        resetRun();
        resetSimulation();
        showToast('Run reset');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
