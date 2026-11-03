// Only needed for the web preview: expo-sqlite runs there on wa-sqlite (WebAssembly),
// which Metro must serve as an asset, and which needs SharedArrayBuffer, so the dev
// server sends the cross-origin isolation headers. Android and iOS are unaffected.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
