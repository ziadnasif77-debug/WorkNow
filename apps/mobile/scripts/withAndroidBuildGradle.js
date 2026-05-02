const { withProjectBuildGradle } = require('@expo/config-plugins')

module.exports = function withAndroidBuildGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      // Add kotlinVersion to ext block if missing
      if (!config.modResults.contents.includes('kotlinVersion')) {
        config.modResults.contents = config.modResults.contents.replace(
          /ext\s*\{/,
          'ext {\n        kotlinVersion = "2.0.21"'
        )
      }
      // Replace $kotlinVersion reference with hardcoded version
      config.modResults.contents = config.modResults.contents.replace(
        /kotlin-gradle-plugin:\$kotlinVersion/g,
        'kotlin-gradle-plugin:2.0.21'
      )
      // Replace kotlin_version reference
      config.modResults.contents = config.modResults.contents.replace(
        /kotlin-gradle-plugin:\$kotlin_version/g,
        'kotlin-gradle-plugin:2.0.21'
      )
    }
    return config
  })
}
