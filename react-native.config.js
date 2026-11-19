// Native modules that are iPhone-only stay out of the Android build: Apple Health
// (HealthKit) and the Nitro runtime it needs. Android reads Health Connect instead.
module.exports = {
  dependencies: {
    '@kingstinct/react-native-healthkit': { platforms: { android: null } },
    '@react-native-healthkit/core': { platforms: { android: null } },
    'react-native-nitro-modules': { platforms: { android: null } },
  },
};
