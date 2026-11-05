import 'expo-router/entry';

import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

// Android home screen widgets. Only loaded when this build includes the widget native
// module, so Expo Go or an older APK starts normally instead of crashing on it.
if (
  Platform.OS === 'android' &&
  (TurboModuleRegistry.get('AndroidWidget') != null || NativeModules.AndroidWidget != null)
) {
  require('./src/widgets/register');
}
