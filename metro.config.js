const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-maps has no web implementation. app/(tabs)/index.tsx (the
// native map screen) still gets pulled into the web bundle graph because
// expo-router's route discovery bundles every file under app/, not just the
// one that wins for the current platform. Aliasing the import for web lets
// that unused-on-web module resolve without crashing the bundler — the real
// web map screen is app/(tabs)/index.web.tsx.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return context.resolveRequest(context, '@teovilla/react-native-web-maps', platform);
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
