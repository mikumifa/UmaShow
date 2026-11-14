import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.mikumifa.autouma',
  appName: 'AutoUma',
  webDir: 'release/app/dist/autouma',
  backgroundColor: '#dff3eb',
  loggingBehavior: 'none',
  android: {
    loggingBehavior: 'none',
  },
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
