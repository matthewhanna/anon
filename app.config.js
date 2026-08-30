// Dynamic layer over app.json. Its only job right now is to inject the
// Google Maps Android key from the environment so it stays out of git.
// The real value lives in .env (gitignored) as GOOGLE_MAPS_ANDROID_API_KEY;
// Expo loads .env before evaluating this file. For EAS/CI, set it as a secret.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
});
