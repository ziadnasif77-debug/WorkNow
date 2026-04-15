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
