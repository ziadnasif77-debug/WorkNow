const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch workspace packages
config.watchFolders = [workspaceRoot];

// Resolve workspace packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// ── Firebase react-native bundle fix ─────────────────────────────────────────
// @firebase/auth ships separate bundles per environment. The react-native
// bundle (dist/rn/index.js) calls registerAuth() as a side effect — the
// browser bundle does NOT. Without these conditions Metro falls back to the
// browser bundle and every route crashes with:
//   "Component auth has not been registered yet"
//
// unstable_conditionNames is additive alongside Expo's platform conditions.
config.resolver.unstable_conditionNames = ["react-native", "require", "default"];

// SVG transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg", "ts", "tsx"];

module.exports = withNativeWind(config, { input: "./global.css" });
