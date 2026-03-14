import { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AppRouter } from './router';
import { ToastContainer } from './components/common/Toast';
import { LandingOverlay, hasVisited } from './components/common/LandingOverlay';

export default function App() {
  const [showLanding] = useState(() => !hasVisited());

  return (
    <HashRouter>
      {showLanding && <LandingOverlay />}
      <AppShell>
        <AppRouter />
      </AppShell>
      <ToastContainer />
    </HashRouter>
  );
}
