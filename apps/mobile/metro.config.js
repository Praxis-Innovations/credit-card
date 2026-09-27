const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm does not link `react` as a peer into some Expo packages (expo-router,
// @expo/metro-runtime, expo-modules-core), so they fall back to the hoisted
// copy, which is apps/web's newer React. Two Reacts in one bundle crash on
// the first hook call, so pin both to this app's versions.
const singletonPackages = ["react", "react-dom"];
const appOrigin = path.join(projectRoot, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = singletonPackages.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
  return context.resolveRequest(
    pinned ? { ...context, originModulePath: appOrigin } : context,
    moduleName,
    platform,
  );
};

module.exports = config;
