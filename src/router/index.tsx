import { Routes, Route, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { LabView } from '../views/LabView';
import { useStore } from '../store';
import { parseDeepLink } from './deeplink';

const CompareView = lazy(() =>
  import('../views/CompareView').then((m) => ({ default: m.CompareView })),
);
const LibraryView = lazy(() =>
  import('../views/LibraryView').then((m) => ({ default: m.LibraryView })),
);
const SavedView = lazy(() =>
  import('../views/SavedView').then((m) => ({ default: m.SavedView })),
);
const SettingsView = lazy(() =>
  import('../views/SettingsView').then((m) => ({ default: m.SettingsView })),
);

function LoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--color-text-dim)',
        fontSize: 'var(--font-size-md)',
      }}
    >
      Loading...
    </div>
  );
}

/**
 * Wrapper for LabView that parses deep link parameters on mount and applies
 * them to the store (labSlice + simulationSlice).
 */
function LabViewWithDeepLink() {
  const [searchParams] = useSearchParams();
  const appliedRef = useRef(false);

  const setDraftValue = useStore((s) => s.setDraftValue);
  const applyAll = useStore((s) => s.applyAll);
  const setDraftSeed = useStore((s) => s.setDraftSeed);
  const showToast = useStore((s) => s.showToast);
  const resetSimulation = useStore((s) => s.resetSimulation);

  useEffect(() => {
    // Only parse deep link once on initial mount
    if (appliedRef.current) return;

    const hasDeepLinkParams =
      searchParams.has('preset') ||
      searchParams.has('config') ||
      searchParams.has('seed');

    if (!hasDeepLinkParams) return;

    appliedRef.current = true;

    const result = parseDeepLink(searchParams);

    // Report errors as toasts
    for (const error of result.errors) {
      showToast(error);
    }

    // Apply config if resolved
    if (result.config) {
      // Set each top-level section field as draft values
      const config = result.config;
      const sections: Array<{ prefix: string; obj: Record<string, unknown> }> = [
        { prefix: 'worm', obj: config.worm as unknown as Record<string, unknown> },
        { prefix: 'sensors', obj: config.sensors as unknown as Record<string, unknown> },
        { prefix: 'behavior', obj: config.behavior as unknown as Record<string, unknown> },
        { prefix: 'world', obj: config.world as unknown as Record<string, unknown> },
        { prefix: 'visuals', obj: config.visuals as unknown as Record<string, unknown> },
      ];

      for (const { prefix, obj } of sections) {
        for (const [key, value] of Object.entries(obj)) {
          setDraftValue(`${prefix}.${key}`, value);
        }
      }

      // Apply all pending draft changes at once
      applyAll();
    }

    // Apply seed if provided
    if (result.seed) {
      setDraftSeed(result.seed);
      // applyAll already sets appliedSeed from draftSeed
      applyAll();
    }

    // Reset the simulation to pick up new config + seed
    // Use a microtask to ensure store updates have settled
    queueMicrotask(() => {
      resetSimulation();
    });
  }, [searchParams, setDraftValue, applyAll, setDraftSeed, showToast, resetSimulation]);

  return <LabView />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<LabViewWithDeepLink />} />
        <Route path="/compare" element={<CompareView />} />
        <Route path="/library" element={<LibraryView />} />
        <Route path="/saved" element={<SavedView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </Suspense>
  );
}
