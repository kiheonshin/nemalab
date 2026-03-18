// ============================================================================
// useKeyboardShortcuts — Global keyboard shortcuts for Lab simulation control
// Space: play/pause | S: step | R: reset
// Disabled when focus is inside text inputs.
// ============================================================================

import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  running: boolean;
  setRunning: (running: boolean) => void;
  onStep: () => void;
  onReset: () => void;
}

/** Returns true when the active element is a text-input context. */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts({
  running,
  setRunning,
  onStep,
  onReset,
}: KeyboardShortcutOptions): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;

      const key = e.key.toLowerCase();

      if (key === ' ') {
        e.preventDefault();
        setRunning(!running);
        return;
      }

      if (key === 's') {
        e.preventDefault();
        onStep();
        return;
      }

      if (key === 'r') {
        e.preventDefault();
        onReset();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onReset, onStep, running, setRunning]);
}
