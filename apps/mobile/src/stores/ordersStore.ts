// ─────────────────────────────────────────────────────────────────────────────
// Orders Store — full lifecycle: create → quote → confirm → complete
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { httpsCallable }    from 'firebase/functions'
import {
  collection, query, where, orderBy,
  onSnapshot, doc, type Unsubscribe,
} from 'firebase/firestore'
import { firebaseFunctions, firestore } from '../lib/firebase'
import type {
  Order, Quote,
  CreateOrderPayload, SubmitQuotePayload,
  AcceptQuotePayload, CancelOrderPayload,
} from '@workfix/types'

interface OrdersState {
  // Customer orders
  myOrders:         Order[]
  ordersLoading:    boolean

  // Provider incoming orders
  incomingOrders:   Order[]
  incomingLoading:  boolean

  // Selected order detail
  activeOrder:      Order | null
  activeQuotes:     Quote[]
  orderLoading:     boolean

  // Action loading
  actionLoading:    boolean
  actionError:      string | null

  // Realtime subscriptions (stored to unsubscribe)
  _unsubOrders:     Unsubscribe | null
  _unsubIncoming:   Unsubscribe | null
  _unsubDetail:     Unsubscribe | null

  // Actions
  subscribeMyOrders:       (customerId: string)  => void
  subscribeIncomingOrders: (providerId: string)  => void
  unsubscribeAll:          ()                    => void
  unsubscribeDetail:       ()                    => void
  loadOrderDetail:         (orderId: string)     => Promise<void>
  createOrder:             (payload: CreateOrderPayload) => Promise<string>
  submitQuote:             (payload: SubmitQuotePayload) => Promise<void>
  acceptQuote:             (payload: AcceptQuotePayload) => Promise<{ amount: number; currency: string } | null>
  confirmCompletion:       (orderId: string)     => Promise<void>
  cancelOrder:             (payload: CancelOrderPayload) => Promise<void>
  clearError:              ()                    => void
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  myOrders:        [],
  ordersLoading:   false,
  incomingOrders:  [],
  incomingLoading: false,
  activeOrder:     null,
  activeQuotes:    [],
  orderLoading:    false,
  actionLoading:   false,
  actionError:     null,
  _unsubOrders:    null,
  _unsubIncoming:  null,
  _unsubDetail:    null,

  // ── subscribeMyOrders (realtime) ──────────────────────────────────────────
  subscribeMyOrders: customerId => {
    const prev = get()._unsubOrders
    if (prev) prev()

    set({ ordersLoading: true })
    const q = query(
      collection(firestore, 'orders'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      const orders = snap.docs.map(d => ({ ...d.data(), id: d.id } as Order))
      set({ myOrders: orders, ordersLoading: false })
    }, err => {
      console.error('orders subscription error', err)
      set({ ordersLoading: false })
    })
    set({ _unsubOrders: unsub })
  },

  // ── subscribeIncomingOrders (realtime) ────────────────────────────────────
  subscribeIncomingOrders: providerId => {
    const prev = get()._unsubIncoming
    if (prev) prev()

    set({ incomingLoading: true })
    const q = query(
      collection(firestore, 'orders'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      const orders = snap.docs.map(d => ({ ...d.data(), id: d.id } as Order))
      set({ incomingOrders: orders, incomingLoading: false })
    }, () => set({ incomingLoading: false }))
    set({ _unsubIncoming: unsub })
  },

  // ── unsubscribeAll ────────────────────────────────────────────────────────
  unsubscribeAll: () => {
    get()._unsubOrders?.()
    get()._unsubIncoming?.()
    get()._unsubDetail?.()
    set({ _unsubOrders: null, _unsubIncoming: null, _unsubDetail: null })
  },
  unsubscribeDetail: () => {
    get()._unsubDetail?.()
    set({ _unsubDetail: null, activeOrder: null, activeQuotes: [] })
  },

  // ── loadOrderDetail ───────────────────────────────────────────────────────
  loadOrderDetail: async orderId => {
    // Cleanup previous detail subscription
    get()._unsubDetail?.()
    set({ orderLoading: true, activeOrder: null, activeQuotes: [] })
    try {
      const orderRef  = doc(firestore, 'orders', orderId)
      const quotesRef = collection(firestore, 'orders', orderId, 'quotes')

      const unsubOrder  = onSnapshot(orderRef, snap => {
        if (snap.exists()) set({ activeOrder: { ...snap.data(), id: snap.id } as Order })
      })
      const unsubQuotes = onSnapshot(
        query(quotesRef, orderBy('createdAt', 'desc')), snap => {
          set({ activeQuotes: snap.docs.map(d => ({ ...d.data(), id: d.id } as Quote)) })
        })

      // Combine both unsubscribers
      set({ _unsubDetail: () => { unsubOrder(); unsubQuotes() } })
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : 'فشل تحميل الطلب' })
    } finally {
      set({ orderLoading: false })
    }
  },

  // ── createOrder ───────────────────────────────────────────────────────────
  createOrder: async payload => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn  = httpsCallable<CreateOrderPayload, { ok: boolean; orderId: string }>(
        firebaseFunctions, 'createOrder',
      )
      const res = await fn(payload)
      return res.data.orderId
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إنشاء الطلب'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  // ── submitQuote ───────────────────────────────────────────────────────────
  submitQuote: async payload => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable<SubmitQuotePayload, { ok: boolean }>(
        firebaseFunctions, 'submitQuote',
      )
      await fn(payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إرسال العرض'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  // ── acceptQuote ───────────────────────────────────────────────────────────
  acceptQuote: async payload => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn  = httpsCallable<AcceptQuotePayload, {
        ok: boolean
        paymentRequired?: { amount: number; currency: string; orderId: string }
      }>(firebaseFunctions, 'acceptQuote')
      const res = await fn(payload)
      return res.data.paymentRequired ?? null
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل قبول العرض'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  // ── confirmCompletion ─────────────────────────────────────────────────────
  confirmCompletion: async orderId => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'confirmCompletion')
      await fn({ orderId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تأكيد الإنجاز'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  // ── cancelOrder ───────────────────────────────────────────────────────────
  cancelOrder: async payload => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable<CancelOrderPayload, { ok: boolean }>(
        firebaseFunctions, 'cancelOrder',
      )
      await fn(payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل الإلغاء'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  // ── submitReview ────────────────────────────────────────────────────────────
  submitReview: async payload => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable<typeof payload, { ok: boolean }>(
        firebaseFunctions, 'submitReview',
      )
      await fn(payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إرسال التقييم'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  // ── openDispute ────────────────────────────────────────────────────────────
  submitReview:            (payload: { orderId: string; targetId: string; targetType: string; rating: number; comment?: string; tags?: string[] }) => Promise<void>
  openDispute: async payload => {
    set({ actionLoading: true, actionError: null })
    try {
      const fn = httpsCallable<typeof payload, { ok: boolean }>(
        firebaseFunctions, 'openDispute',
      )
      await fn(payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إرسال النزاع'
      set({ actionError: msg })
      throw err
    } finally {
      set({ actionLoading: false })
    }
  },

  clearError: () => set({ actionError: null }),
}))
