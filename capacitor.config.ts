import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitalkingdom.digibiashara',
  appName: 'DigiBiashara',
  webDir: 'android-shell',
  server: {
    url: 'https://digibiashara-tau.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
