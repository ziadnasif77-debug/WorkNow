// ─────────────────────────────────────────────────────────────────────────────
// authStore unit tests
// Firebase is globally mocked in jest.setup.js
// ─────────────────────────────────────────────────────────────────────────────

import { useAuthStore } from '../../stores/authStore'

// firebase/auth is mocked per-test below (not in setup, for flexibility)
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword:     jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPhoneNumber:          jest.fn(),
  signOut:                        jest.fn(() => Promise.resolve()),
  onAuthStateChanged:             jest.fn(() => jest.fn()),  // returns unsubscribe
  GoogleAuthProvider:             class {},
  signInWithCredential:           jest.fn(),
  updateProfile:                  jest.fn(() => Promise.resolve()),
}))

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const resetStore = () =>
  useAuthStore.setState({
    firebaseUser:       null,
    appUser:            null,
    role:               null,
    isLoading:          false,
    isInitialized:      false,
    error:              null,
    confirmationResult: null,
  })

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authStore — initial state', () => {
  beforeEach(resetStore)

  it('starts unauthenticated and uninitialized', () => {
    const s = useAuthStore.getState()
    expect(s.firebaseUser).toBeNull()
    expect(s.isLoading).toBe(false)
    expect(s.isInitialized).toBe(false)
    expect(s.role).toBeNull()
    expect(s.error).toBeNull()
  })
})

describe('authStore — clearError', () => {
  beforeEach(resetStore)

  it('clears the error field', () => {
    useAuthStore.setState({ error: 'some error' })
    useAuthStore.getState().clearError()
    expect(useAuthStore.getState().error).toBeNull()
  })
})

describe('authStore — signInEmail', () => {
  beforeEach(resetStore)

  it('sets isLoading=true during request, false after', async () => {
    const { signInWithEmailAndPassword } = require('firebase/auth')
    let resolveSignIn!: () => void
    signInWithEmailAndPassword.mockImplementationOnce(
      () => new Promise<void>(res => { resolveSignIn = res }),
    )

    const p = useAuthStore.getState().signInEmail('a@b.com', 'pass123')
    expect(useAuthStore.getState().isLoading).toBe(true)

    resolveSignIn()
    await p
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('maps auth/wrong-password to Arabic message', async () => {
    const { signInWithEmailAndPassword } = require('firebase/auth')
    const err = Object.assign(new Error(), { code: 'auth/wrong-password' })
    signInWithEmailAndPassword.mockRejectedValueOnce(err)

    await expect(useAuthStore.getState().signInEmail('a@b.com', 'bad')).rejects.toThrow()
    expect(useAuthStore.getState().error).toBe('كلمة المرور غير صحيحة')
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('maps auth/user-not-found to Arabic message', async () => {
    const { signInWithEmailAndPassword } = require('firebase/auth')
    const err = Object.assign(new Error(), { code: 'auth/user-not-found' })
    signInWithEmailAndPassword.mockRejectedValueOnce(err)

    await expect(useAuthStore.getState().signInEmail('none@x.com', 'pass')).rejects.toThrow()
    expect(useAuthStore.getState().error).toContain('لم يُعثر')
  })
})

describe('authStore — signUpEmail', () => {
  beforeEach(resetStore)

  it('calls Analytics.signUpStart before createUser', async () => {
    const { createUserWithEmailAndPassword } = require('firebase/auth')
    createUserWithEmailAndPassword.mockResolvedValueOnce({})
    const Analytics = require('../../lib/analytics').Analytics
    jest.spyOn(Analytics, 'signUpStart').mockImplementation(jest.fn())

    await useAuthStore.getState().signUpEmail('new@x.com', 'pass123')
    expect(Analytics.signUpStart).toHaveBeenCalledWith('email')
  })

  it('maps auth/email-already-in-use', async () => {
    const { createUserWithEmailAndPassword } = require('firebase/auth')
    const err = Object.assign(new Error(), { code: 'auth/email-already-in-use' })
    createUserWithEmailAndPassword.mockRejectedValueOnce(err)

    await expect(useAuthStore.getState().signUpEmail('dup@x.com', 'pass')).rejects.toThrow()
    expect(useAuthStore.getState().error).toContain('مسجَّل')
  })
})
