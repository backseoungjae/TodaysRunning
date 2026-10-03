import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !androidGoogleMapsApiKey) {
    throw new Error('Android build requires GOOGLE_MAPS_ANDROID_API_KEY. Configure the existing key in the selected EAS environment.');
  }
  return {
    ...config,
    name: config.name ?? 'TodaysRunning',
    slug: config.slug ?? 'TodaysRunning',
    extra: { ...config.extra, maps: { androidConfigured: Boolean(androidGoogleMapsApiKey) } },
    plugins: [
      ...(config.plugins ?? []).filter((plugin) => (typeof plugin === 'string' ? plugin : plugin[0]) !== 'react-native-maps'),
      ['react-native-maps', androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}],
    ],
  };
};
