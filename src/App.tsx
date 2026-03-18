import { useEffect, useState } from 'react';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AppRouter } from './router';
import { ToastContainer } from './components/common/Toast';
import { LandingOverlay, hasVisited } from './components/common/LandingOverlay';
import { trackPageView } from './analytics';
import { useStore } from './store';

function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    trackPageView(path || '/');
  }, [location.pathname, location.search]);

  return null;
}

function RoutedApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const loadSettings = useStore((s) => s.loadSettings);
  const showOnboarding = useStore((s) => s.settings.showOnboarding);
  const [settingsReady, setSettingsReady] = useState(false);
  const [landingDismissed, setLandingDismissed] = useState(false);

  useEffect(() => {
    loadSettings();
    setSettingsReady(true);
  }, [loadSettings]);

  const isEntryRoute = location.pathname === '/';
  const entryParams = new URLSearchParams(location.search);
  const hasLegacyDeepLink =
    entryParams.has('preset') || entryParams.has('config') || entryParams.has('seed');

  const shouldShowLanding =
    settingsReady &&
    isEntryRoute &&
    !hasLegacyDeepLink &&
    !landingDismissed &&
    (!hasVisited() || showOnboarding);

  useEffect(() => {
    if (!settingsReady || !isEntryRoute || shouldShowLanding) return;

    navigate(
      {
        pathname: '/simulator',
        search: location.search,
      },
      { replace: true },
    );
  }, [settingsReady, isEntryRoute, shouldShowLanding, location.search, navigate]);

  return (
    <>
      <AnalyticsRouteTracker />
      {shouldShowLanding ? <LandingOverlay onDismiss={() => setLandingDismissed(true)} /> : null}
      <AppShell>
        <AppRouter />
      </AppShell>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <RoutedApp />
    </HashRouter>
  );
}
