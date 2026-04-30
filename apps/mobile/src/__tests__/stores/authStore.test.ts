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

describe('authStore — sendPhoneOtp', () => {
  beforeEach(resetStore)

  it('throws when recaptchaVerifier is not set', async () => {
    await expect(useAuthStore.getState().sendPhoneOtp('+966500000000')).rejects.toThrow()
    expect(useAuthStore.getState().error).toBeTruthy()
  })

  it('stores confirmationResult on success', async () => {
    const { signInWithPhoneNumber } = require('firebase/auth')
    const mockConfirmation = { confirm: jest.fn() }
    signInWithPhoneNumber.mockResolvedValueOnce(mockConfirmation)

    useAuthStore.setState({ recaptchaVerifier: {} as never })
    await useAuthStore.getState().sendPhoneOtp('+966500000000')
    expect(useAuthStore.getState().confirmationResult).toBe(mockConfirmation)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})

describe('authStore — confirmPhoneOtp', () => {
  beforeEach(resetStore)

  it('throws when no OTP session', async () => {
    await expect(useAuthStore.getState().confirmPhoneOtp('123456')).rejects.toThrow()
  })

  it('clears confirmationResult on success', async () => {
    const mockConfirm = jest.fn(() => Promise.resolve())
    useAuthStore.setState({ confirmationResult: { confirm: mockConfirm } as never })
    await useAuthStore.getState().confirmPhoneOtp('123456')
    expect(useAuthStore.getState().confirmationResult).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('sets Arabic error on wrong OTP', async () => {
    const mockConfirm = jest.fn(() => Promise.reject(new Error('wrong')))
    useAuthStore.setState({ confirmationResult: { confirm: mockConfirm } as never })
    await expect(useAuthStore.getState().confirmPhoneOtp('000000')).rejects.toThrow()
    expect(useAuthStore.getState().error).toBeTruthy()
  })
})

describe('authStore — signOut', () => {
  beforeEach(resetStore)

  it('clears user state after sign out', async () => {
    useAuthStore.setState({
      firebaseUser: { uid: 'u1' } as never,
      appUser:      { uid: 'u1' } as never,
      role:         'customer',
    })
    await useAuthStore.getState().signOut()
    const s = useAuthStore.getState()
    expect(s.firebaseUser).toBeNull()
    expect(s.appUser).toBeNull()
    expect(s.role).toBeNull()
  })
})

describe('authStore — completeProfile', () => {
  beforeEach(resetStore)

  it('calls httpsCallable and resolves', async () => {
    const { httpsCallable } = require('firebase/functions')
    const mockFn = jest.fn(() => Promise.resolve({ data: {} }))
    httpsCallable.mockReturnValueOnce(mockFn)

    await useAuthStore.getState().completeProfile({ displayName: 'Ahmed', role: 'customer' } as never)
    expect(mockFn).toHaveBeenCalled()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('sets error on failure', async () => {
    const { httpsCallable } = require('firebase/functions')
    httpsCallable.mockReturnValueOnce(jest.fn(() => Promise.reject(new Error('network'))))

    await expect(
      useAuthStore.getState().completeProfile({ displayName: 'X', role: 'customer' } as never)
    ).rejects.toThrow()
    expect(useAuthStore.getState().error).toBeTruthy()
  })
})
