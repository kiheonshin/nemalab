import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kiheonshin.nemalab',
  appName: 'Nema Lab',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#0f1722',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f1722',
      showSpinner: false,
    },
  },
};

export default config;
