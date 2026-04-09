// ─────────────────────────────────────────────────────────────────────────────
// Auth Store — Zustand
// Single source of truth for authentication state across the app
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  type User as FirebaseUser,
  type ConfirmationResult,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { firebaseAuth, firebaseFunctions } from '../lib/firebase'
import { Analytics } from '../lib/analytics'
import type { User, UserRole, CompleteProfilePayload } from '@workfix/types'

interface AuthState {
  // State
  firebaseUser:    FirebaseUser | null
  appUser:         User | null
  role:            UserRole | null
  isLoading:       boolean
  isInitialized:   boolean
  error:           string | null

  // Phone OTP flow
  confirmationResult:   ConfirmationResult | null
  // reCAPTCHA verifier — injected by the screen before calling sendPhoneOtp.
  // On native (iOS/Android) this must be an ApplicationVerifier-compatible object
  // (e.g. from expo-firebase-recaptcha). On web it's window.recaptchaVerifier.
  recaptchaVerifier:    unknown | null

  // Actions
  initialize:           () => () => void   // returns unsubscribe
  signInEmail:          (email: string, password: string) => Promise<void>
  signUpEmail:          (email: string, password: string) => Promise<void>
  setRecaptchaVerifier: (verifier: unknown) => void
  sendPhoneOtp:         (phone: string) => Promise<void>
  confirmPhoneOtp:      (otp: string) => Promise<void>
  completeProfile:      (payload: CompleteProfilePayload) => Promise<void>
  setProviderType:      (type: 'individual' | 'company', businessName?: string, lat?: number, lng?: number, city?: string) => Promise<void>
  signOut:              () => Promise<void>
  clearError:           () => void
  updateDisplayName:    (name: string, avatarUrl?: string | null) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser:       null,
  appUser:            null,
  role:               null,
  isLoading:          false,
  isInitialized:      false,
  error:              null,
  confirmationResult: null,
  recaptchaVerifier:  null,

  // ── setRecaptchaVerifier ──────────────────────────────────────────────────
  setRecaptchaVerifier: (verifier) => set({ recaptchaVerifier: verifier }),

  // ── initialize ─────────────────────────────────────────────────────────────
  initialize: () => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async fbUser => {
      if (fbUser) {
        // Get fresh token with custom claims
        const token = await fbUser.getIdTokenResult(true)
        const role = (token.claims['role'] as UserRole | undefined) ?? 'customer'
        set({ firebaseUser: fbUser, role, isInitialized: true })
      } else {
        set({
          firebaseUser: null,
          appUser:      null,
          role:         null,
          isInitialized: true,
        })
      }
    })
    return unsubscribe
  },

  // ── Email sign-in ──────────────────────────────────────────────────────────
  signInEmail: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Email sign-up ──────────────────────────────────────────────────────────
  signUpEmail: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      Analytics.signUpStart('email')
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Phone OTP ──────────────────────────────────────────────────────────────
  // The calling screen must first call setRecaptchaVerifier(verifier) with a
  // platform-appropriate ApplicationVerifier:
  //   • iOS/Android: use FirebaseRecaptchaVerifierModal from expo-firebase-recaptcha
  //   • Web:         window.recaptchaVerifier (RecaptchaVerifier instance)
  sendPhoneOtp: async phone => {
    const verifier = get().recaptchaVerifier
    if (!verifier) {
      set({ error: 'يرجى إتمام التحقق بـ reCAPTCHA أولاً.' })
      throw new Error('RecaptchaVerifier not set — call setRecaptchaVerifier() from the screen first')
    }
    set({ isLoading: true, error: null })
    try {
      const confirmation = await signInWithPhoneNumber(
        firebaseAuth,
        phone,
        verifier as Parameters<typeof signInWithPhoneNumber>[2],
      )
      set({ confirmationResult: confirmation })
    } catch (err) {
      set({ error: getErrorMessage(err) })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  confirmPhoneOtp: async otp => {
    const { confirmationResult } = get()
    if (!confirmationResult) throw new Error('No OTP session — call sendPhoneOtp first')

    set({ isLoading: true, error: null })
    try {
      await confirmationResult.confirm(otp)
      set({ confirmationResult: null })
    } catch (err) {
      set({ error: 'الرمز غير صحيح. يرجى المحاولة مجدداً.' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Complete profile ───────────────────────────────────────────────────────
  completeProfile: async payload => {
    set({ isLoading: true, error: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'auth-completeProfile')
      await fn(payload)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Set provider type ──────────────────────────────────────────────────────
  setProviderType: async (type, businessName, lat = 24.7136, lng = 46.6753, city = 'الرياض') => {
    set({ isLoading: true, error: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'auth-setProviderType')
      await fn({ type, businessName, lat, lng, city, country: 'SA' })
      // Refresh token to pick up new role claim
      await firebaseAuth.currentUser?.getIdToken(true)
    } catch (err) {
      set({ error: getErrorMessage(err) })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Sign out ───────────────────────────────────────────────────────────────
  signOut: async () => {
    try {
      const { clearMonitoringUser } = await import('../lib/monitoring')
      clearMonitoringUser()
      await signOut(firebaseAuth)
    } catch (err) {
      if (__DEV__) console.warn('[Auth] signOut error', err)
    } finally {
      // Always clear local state regardless of network errors
      set({ firebaseUser: null, appUser: null, role: null })
    }
  },

  clearError: () => set({ error: null }),

  // ── updateDisplayName ─────────────────────────────────────────────────────
  updateDisplayName: async (name, avatarUrl) => {
    const user = firebaseAuth.currentUser
    if (!user) throw new Error('Not authenticated')
    set({ isLoading: true, error: null })
    try {
      const { updateProfile } = await import('firebase/auth')
      const { doc, updateDoc } = await import('firebase/firestore')
      const { firestore }      = await import('../lib/firebase')
      await updateProfile(user, { displayName: name, photoURL: avatarUrl ?? undefined })
      await updateDoc(doc(firestore, 'users', user.uid), {
        displayName: name,
        avatarUrl:   avatarUrl ?? null,
        updatedAt:   new Date(),
      })
    } catch (err) {
      set({ error: getErrorMessage(err) })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },
}))

// ── Error message helper ───────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code ?? ''
    const messages: Record<string, string> = {
      'auth/user-not-found':      'لم يُعثر على حساب بهذا البريد الإلكتروني',
      'auth/wrong-password':      'كلمة المرور غير صحيحة',
      'auth/email-already-in-use': 'هذا البريد مسجَّل مسبقاً',
      'auth/invalid-phone-number': 'رقم الهاتف غير صحيح',
      'auth/too-many-requests':   'محاولات كثيرة. يرجى الانتظار.',
      'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
    }
    return messages[code] ?? err.message
  }
  return 'حدث خطأ غير متوقع'
}
