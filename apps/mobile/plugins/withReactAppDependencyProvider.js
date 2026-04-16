const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withReactAppDependencyProvider(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (!podfile.includes('ReactAppDependencyProvider')) {
        podfile = podfile.replace(
          "use_expo_modules!",
          "pod 'ReactAppDependencyProvider', :path => '../../../node_modules/.pnpm/react-native@0.76.3_@babel+core@7.29.0_@babel+preset-env@7.29.2_@babel+core@7.29.0__@react-na_ae3nfj7qc5hydleqc2b5wne7fa/node_modules/react-native/Libraries/AppDelegate'\n  use_expo_modules!"
        );
        fs.writeFileSync(podfilePath, podfile);
      }
      return config;
    },
  ]);
};
