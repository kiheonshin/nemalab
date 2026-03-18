import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { LabView } from '../views/LabView';
import { useStore } from '../store';
import { parseDeepLink } from './deeplink';

const CompareView = lazy(() =>
  import('../views/CompareView').then((m) => ({ default: m.CompareView })),
);
const Connectome2View = lazy(() =>
  import('../views/Connectome2View').then((m) => ({ default: m.Connectome2View })),
);
const NexusView = lazy(() =>
  import('../views/NexusView').then((m) => ({ default: m.NexusView })),
);
const LibraryView = lazy(() =>
  import('../views/LibraryView').then((m) => ({ default: m.LibraryView })),
);
const SettingsView = lazy(() =>
  import('../views/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const CreditsView = lazy(() =>
  import('../views/CreditsView').then((m) => ({ default: m.CreditsView })),
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

function EntryRoute() {
  return null;
}

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<EntryRoute />} />
        <Route path="/simulator" element={<LabViewWithDeepLink />} />
        <Route path="/compare" element={<CompareView />} />
        <Route path="/connectome" element={<Connectome2View />} />
        <Route path="/connectome2" element={<Connectome2View />} />
        <Route path="/synchrony" element={<NexusView />} />
        <Route path="/nexus" element={<NexusView />} />
        <Route path="/library" element={<LibraryView />} />
        <Route path="/saved" element={<Navigate to="/settings" replace />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/credit" element={<Navigate to="/credits" replace />} />
        <Route path="/credits" element={<CreditsView />} />
      </Routes>
    </Suspense>
  );
}
