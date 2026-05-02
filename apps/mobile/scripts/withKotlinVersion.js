const { withDangerousMod } = require('@expo/config-plugins')
const path = require('path')
const fs = require('fs')

const KOTLIN_VERSION = '2.1.0'

function patchFile(filePath, replacements) {
  try {
    let contents = fs.readFileSync(filePath, 'utf8')
    let changed = false
    for (const [pattern, replacement] of replacements) {
      const updated = contents.replace(pattern, replacement)
      if (updated !== contents) {
        contents = updated
        changed = true
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, contents, 'utf8')
      console.log('[withKotlinVersion] Patched:', path.basename(filePath))
    } else {
      console.warn('[withKotlinVersion] No match found in:', path.basename(filePath))
      console.warn('[withKotlinVersion] First 300 chars:', contents.substring(0, 300))
    }
    return changed
  } catch (e) {
    // File may not exist during local config evaluation
    return false
  }
}

module.exports = function withKotlinVersion(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const root = config.modRequest.platformProjectRoot
      console.log('[withKotlinVersion] Platform root:', root)

      // Strategy 1: Groovy build.gradle (classic ext block)
      patchFile(path.join(root, 'build.gradle'), [
        [/kotlinVersion\s*=\s*["'][\d.]+["']/g, `kotlinVersion = "${KOTLIN_VERSION}"`],
      ])

      // Strategy 2: TOML version catalog (RN 0.73+)
      patchFile(path.join(root, 'gradle', 'libs.versions.toml'), [
        [/^kotlin\s*=\s*["'][\d.]+["']/gm, `kotlin = "${KOTLIN_VERSION}"`],
        [/^kotlinVersion\s*=\s*["'][\d.]+["']/gm, `kotlinVersion = "${KOTLIN_VERSION}"`],
      ])

      return config
    },
  ])
}
