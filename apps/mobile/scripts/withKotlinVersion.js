const { withDangerousMod } = require('@expo/config-plugins')
const path = require('path')
const fs   = require('fs')

const KOTLIN_VERSION = '2.1.0'

function patch(filePath, replacements) {
  try {
    let src = fs.readFileSync(filePath, 'utf8')
    let changed = false
    for (const [pattern, replacement] of replacements) {
      const next = src.replace(pattern, replacement)
      if (next !== src) { src = next; changed = true }
    }
    if (changed) fs.writeFileSync(filePath, src, 'utf8')
  } catch { /* file may not exist */ }
}

module.exports = function withKotlinVersion(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const root = config.modRequest.platformProjectRoot

      // RN 0.73+ — version catalog (libs.versions.toml)
      patch(path.join(root, 'gradle', 'libs.versions.toml'), [
        [/^kotlin\s*=\s*["'][\d.]+["']/m,        `kotlin = "${KOTLIN_VERSION}"`],
        [/^kotlinVersion\s*=\s*["'][\d.]+["']/m, `kotlinVersion = "${KOTLIN_VERSION}"`],
      ])

      // Legacy — build.gradle ext block
      patch(path.join(root, 'build.gradle'), [
        [/kotlinVersion\s*=\s*["'][\d.]+["']/g, `kotlinVersion = "${KOTLIN_VERSION}"`],
        // Hardcode when variable is undefined
        [
          /classpath\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$kotlinVersion["']/g,
          `classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}"`,
        ],
      ])

      return config
    },
  ])
}
