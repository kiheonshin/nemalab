import { Capacitor } from '@capacitor/core';

export const isNativeShell = Capacitor.isNativePlatform();
export const nativePlatform = Capacitor.getPlatform();

export async function initializeNativeShell() {
  if (!isNativeShell) {
    return;
  }

  const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ]);

  try {
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    // Ignore plugin failures on unsupported platforms.
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // Ignore plugin failures on unsupported platforms.
  }

  requestAnimationFrame(() => {
    void SplashScreen.hide({ fadeOutDuration: 180 });
  });
}
