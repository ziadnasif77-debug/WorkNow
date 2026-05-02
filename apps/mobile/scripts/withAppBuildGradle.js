const { withAppBuildGradle } = require('@expo/config-plugins')

module.exports = function withFixAppBuildGradle(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /\s*enableBundleCompression\s*=.*\n/g,
      '\n'
    )
    return config
  })
}
