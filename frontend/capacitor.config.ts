import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'AGI Meeting Room',
  webDir: 'www',
  server: {
    cleartext: true
  },
  /** Dev HTTP / mixed content; after `cap add android` also set usesCleartextTraffic on the application tag if needed. */
  android: {
    allowMixedContent: true
  }
};

export default config;
