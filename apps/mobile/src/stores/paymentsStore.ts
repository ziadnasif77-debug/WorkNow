// ─────────────────────────────────────────────────────────────────────────────
// Payments Store — initiate payment, wallet balance, payout request
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { httpsCallable } from 'firebase/functions'
import { firebaseFunctions } from '../lib/firebase'
import { mapFirebaseError } from '../lib/firebaseErrorMap'
import type { PaymentMethod, Currency } from '@workfix/types'

interface WalletBalance {
  availableBalance:  number
  pendingBalance:    number
  processingPayouts: number
  currency:          Currency
}

interface PaymentsState {
  // Payment initiation
  isInitiating:  boolean
  initError:     string | null
  redirectUrl:   string | null
  tapChargeId:   string | null

  // Wallet (provider)
  wallet:         WalletBalance | null
  walletLoading:  boolean
  walletError:    string | null

  // Payout
  payoutLoading:  boolean
  payoutError:    string | null
  lastPayoutId:   string | null

  // Actions
  initiatePayment:  (orderId: string, method: PaymentMethod, returnUrl?: string) => Promise<string | null>
  loadWallet:       () => Promise<void>
  clearWalletError: () => void
  requestPayout:    (amount?: number) => Promise<void>
  clearErrors:         () => void
  reset:               () => void
  createSubscription:  (tier: string, billing: string) => Promise<{ redirectUrl?: string }>
  saveBankAccount:     (data: { iban?: string; bankName?: string; accountNumber?: string; accountHolder?: string }) => Promise<void>
}

export const usePaymentsStore = create<PaymentsState>((set) => ({
  isInitiating:   false,
  initError:      null,
  redirectUrl:    null,
  tapChargeId:    null,
  wallet:         null,
  walletLoading:  false,
  walletError:    null,
  payoutLoading:  false,
  payoutError:    null,
  lastPayoutId:   null,

  // ── initiatePayment ───────────────────────────────────────────────────────
  initiatePayment: async (orderId, method, returnUrl) => {
    set({ isInitiating: true, initError: null, redirectUrl: null })
    try {
      const fn  = httpsCallable<
        { orderId: string; method: PaymentMethod; returnUrl?: string },
        { ok: boolean; tapChargeId?: string; redirectUrl?: string; method?: string }
      >(firebaseFunctions, 'initiatePayment')

      const res = await fn({ orderId, method, returnUrl })

      if (method === 'cash') return 'cash'

      set({
        tapChargeId: res.data.tapChargeId ?? null,
        redirectUrl: res.data.redirectUrl ?? null,
      })
      return res.data.redirectUrl ?? null
    } catch (err) {
      set({ initError: mapFirebaseError(err) })
      throw err
    } finally {
      set({ isInitiating: false })
    }
  },

  // ── loadWallet ────────────────────────────────────────────────────────────
  loadWallet: async () => {
    set({ walletLoading: true, walletError: null })
    try {
      const fn  = httpsCallable<Record<string, never>, WalletBalance & { ok: boolean }>(
        firebaseFunctions, 'getWalletBalance',
      )
      const res = await fn({})
      set({ wallet: res.data })
    } catch (err) {
      set({ walletError: mapFirebaseError(err) })
    } finally {
      set({ walletLoading: false })
    }
  },

  // ── requestPayout ─────────────────────────────────────────────────────────
  requestPayout: async amount => {
    set({ payoutLoading: true, payoutError: null })
    try {
      const fn  = httpsCallable<{ amount?: number }, { ok: boolean; payoutId: string; amount: number }>(
        firebaseFunctions, 'requestPayout',
      )
      const res = await fn({ amount })
      set({ lastPayoutId: res.data.payoutId })
      // Refresh wallet after payout
      const walletFn  = httpsCallable<Record<string, never>, WalletBalance & { ok: boolean }>(
        firebaseFunctions, 'getWalletBalance',
      )
      const walletRes = await walletFn({})
      set({ wallet: walletRes.data })
    } catch (err) {
      set({ payoutError: mapFirebaseError(err) })
      throw err
    } finally {
      set({ payoutLoading: false })
    }
  },

  clearErrors:      () => set({ initError: null, payoutError: null }),
  clearWalletError: () => set({ walletError: null }),

  // ── createSubscription ───────────────────────────────────────────────────────
  createSubscription: async (tier, billing) => {
    set({ initError: null })
    try {
      const fn = httpsCallable<
        { tier: string; billing: string },
        { ok: boolean; redirectUrl?: string }
      >(firebaseFunctions, 'createSubscription')
      const res = await fn({ tier, billing })
      return { redirectUrl: res.data.redirectUrl }
    } catch (err) {
      set({ initError: mapFirebaseError(err) })
      throw err
    }
  },

  // ── saveBankAccount ───────────────────────────────────────────────────────
  saveBankAccount: async data => {
    const uid = (await import('../lib/firebase')).firebaseAuth.currentUser?.uid
    if (!uid) throw new Error('Not authenticated')
    const { doc, updateDoc } = await import('firebase/firestore')
    const { firestore }      = await import('../lib/firebase')
    await updateDoc(doc(firestore, 'providerProfiles', uid), {
      bankAccount: { ...data, addedAt: new Date() },
      updatedAt:   new Date(),
    })
  },
  reset:       () => set({ redirectUrl: null, tapChargeId: null, initError: null }),
}))
