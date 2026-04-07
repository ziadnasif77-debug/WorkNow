// Module augmentation — adds getReactNativePersistence to firebase/auth types.
// The function exists in the RN bundle that Metro resolves at runtime, but is
// absent from the default TypeScript typings (which target the browser build).
import type { Persistence } from 'firebase/auth'

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence
}
