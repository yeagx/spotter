// Live music waves on Android (modules/spotter-media) need RECORD_AUDIO: Android's
// Visualizer only gives the playing sound's levels to an app holding it. Spotter never
// uses the microphone, so expo-image-picker is set to `microphonePermission: false`,
// and on Android that also writes a "remove RECORD_AUDIO" rule into the manifest,
// which wins over the module's own declaration. This runs after every other plugin
// and takes that one rule out, so the permission ships and can be asked for.
const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

const PERMISSION = 'android.permission.RECORD_AUDIO';

module.exports = function withLiveWaves(config) {
  return withFinalizedMod(config, [
    'android',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
      let xml = fs.readFileSync(file, 'utf8');
      xml = xml.replace(/[ \t]*<uses-permission\b[^>]*android\.permission\.RECORD_AUDIO[^>]*tools:node="remove"[^>]*\/>\r?\n?/g, '');
      if (!xml.includes(`"${PERMISSION}"`)) {
        xml = xml.replace(/(<manifest\b[^>]*>)/, `$1\n  <uses-permission android:name="${PERMISSION}"/>`);
      }
      fs.writeFileSync(file, xml);
      return config;
    },
  ]);
};
