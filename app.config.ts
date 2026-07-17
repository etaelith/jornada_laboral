import type { ExpoConfig } from 'expo/config';

const configuredArchs = process.env.JORNADA_ANDROID_ARCHS?.split(',').filter(Boolean) ?? [
  'armeabi-v7a',
  'arm64-v8a',
];

const config: ExpoConfig = {
  name: 'Jornada Laboral',
  slug: 'jornada-laboral',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'jornadalaboral',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0b1220',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.jornadalaboral.app',
    infoPlist: {
      NSFaceIDUsageDescription: 'Usamos Face ID para proteger tus registros laborales.',
    },
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.jornadalaboral.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#0b1220',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-sharing',
    ['expo-sqlite', { useSQLCipher: true }],
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
        faceIDPermission: 'Usamos Face ID para proteger tus registros laborales.',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
          buildArchs: configuredArchs,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          useDayNightTheme: true,
        },
        ios: { deploymentTarget: '15.1' },
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Usamos Face ID para desbloquear tus registros laborales.' },
    ],
    ['expo-notifications', { defaultChannel: 'recordatorios' }],
  ],
  experiments: { typedRoutes: true },
};

export default config;
