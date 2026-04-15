# WorkNow — Claude Instructions

## Version Freeze Policy (STRICT)

**NEVER change any version number without explicit user permission.**

This applies to every file in the repository, including:

- `package.json` — `dependencies`, `devDependencies`, `peerDependencies`, `engines`, `packageManager`
- `pnpm-lock.yaml` — any lockfile version entries
- `apps/mobile/package.json` — Expo SDK, React Native, and all dependencies
- `.github/workflows/*.yml` — action versions (`@v3`, `@v4`), `NODE_VERSION`, `PNPM_VERSION`, Java version, tool versions
- `app.json` / `eas.json` — `sdkVersion`, `runtimeVersion`, `buildNumber`, `versionCode`
- `tsconfig*.json` — `target`, `lib` entries
- `firebase.json` — emulator port versions or SDK configs
- Any other config file containing a version number

**Before changing any version, the user must explicitly say:**
> "Change version X to Y" or "Upgrade X from A to B"

If a version change is needed to fix a bug, **propose it and wait for approval** — do not apply it unilaterally.

## Frozen Stack — apps/mobile (STRICT)

The following versions are **locked by the user** and must NOT be changed under any circumstance without explicit written permission:

| Package | Frozen Version |
|---|---|
| `expo` | `~54.0.0` |
| `react` | `18.2.0` |
| `react-native` | `0.76.3` |
| `expo-router` | `~3.5.23` |
| `react-native-reanimated` | `~3.10.1` |
| `react-native-gesture-handler` | `~2.20.2` |
| `react-native-safe-area-context` | `4.12.0` |
| `react-native-screens` | `~3.35.0` |
| `expo-document-picker` | `~12.0.1` |
| `expo-font` | `~13.0.2` |
| `expo-image-picker` | `~16.0.3` |
| `expo-location` | `~18.0.4` |
| `expo-notifications` | `~0.29.11` |
| `expo-secure-store` | `~14.0.0` |
| `expo-status-bar` | `~2.0.1` |
| `expo-store-review` | `~7.4.0` |
| `expo-updates` | `~0.26.11` |
| `@types/react` | `~18.2.45` |
| `react-test-renderer` | `18.2.0` |
| `jest-expo` | `~54.0.17` |

This stack is the **Expo SDK 54 stable baseline** compatible with Expo Go v54 on the user's physical device.

**Do NOT suggest, auto-fix, or apply any version change to these packages without the user saying explicitly:**
> "غيّر X إلى Y" / "Change X to Y" / "Upgrade X from A to B"
