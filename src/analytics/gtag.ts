// ============================================================================
// GA4 — gtag helper functions
// Fire-and-forget analytics calls. Safe when gtag is not loaded.
// ============================================================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}

export function trackPageView(path: string): void {
  trackEvent('page_view', {
    page_path: path,
    page_location:
      typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#${path}` : path,
    page_title: typeof document !== 'undefined' ? document.title : 'Nema Lab',
  });
}
