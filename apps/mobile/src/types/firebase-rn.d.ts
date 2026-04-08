// ─────────────────────────────────────────────────────────────────────────────
// Module augmentation: add getReactNativePersistence to firebase/auth types.
//
// Why: firebase/auth's package.json exports have no "react-native" types
// condition, so TypeScript resolves to auth-public.d.ts which omits this
// function. At runtime Metro picks the correct react-native bundle (dist/rn)
// which exports it. This declaration makes the types agree with the runtime.
// ─────────────────────────────────────────────────────────────────────────────
import type { Persistence } from 'firebase/auth'

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence
}
