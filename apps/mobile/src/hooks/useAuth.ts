// ─────────────────────────────────────────────────────────────────────────────
// useAuth — convenience hook wrapping the auth store
// Use this in screens instead of importing useAuthStore directly
// ─────────────────────────────────────────────────────────────────────────────

import { useAuthStore } from '../stores/authStore'

export function useAuth() {
  const store = useAuthStore()
  return {
    user:          store.firebaseUser,
    role:          store.role,
    isLoading:     store.isLoading,
    isInitialized: store.isInitialized,
    isLoggedIn:    !!store.firebaseUser,
    isProvider:    store.role === 'provider',
    isCustomer:    store.role === 'customer',
    isAdmin:       store.role === 'admin' || store.role === 'superadmin',
    signOut:       store.signOut,
    error:         store.error,
    clearError:    store.clearError,
  }
}
