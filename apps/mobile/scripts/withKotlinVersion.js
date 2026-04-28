const { withBuildGradle } = require('@expo/config-plugins')

const KOTLIN_VERSION = '2.0.21'

module.exports = function withKotlinVersion(config) {
  return withBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /kotlinVersion\s*=\s*["'][\d.]+["']/g,
      `kotlinVersion = "${KOTLIN_VERSION}"`
    )
    return config
  })
}
