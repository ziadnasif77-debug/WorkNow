// ─────────────────────────────────────────────────────────────────────────────
// Messaging Store — realtime conversations + messages via Firestore onSnapshot
// Typing indicator: TTL-based — one write per burst (no delete needed)
// Sets typingExpiresAt.{uid} = Date.now() + TTL_MS; client checks > Date.now()
// Read receipts:    markRead() updates isRead + readAt on messages
// ─────────────────────────────────────────────────────────────────────────────

import { create }           from 'zustand'
import { httpsCallable }    from 'firebase/functions'
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, updateDoc, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { firebaseFunctions, firestore } from '../lib/firebase'
import type { Conversation, Message } from '@workfix/types'

const TYPING_TTL_MS     = 5000   // typing indicator expires after 5 s of silence
// Legacy constant kept for backward-compat reading old boolean typingStatus docs
const TYPING_TIMEOUT_MS = TYPING_TTL_MS
const MESSAGES_PAGE     = 30     // messages loaded per batch

interface MessagingState {
  // Conversations list
  conversations:       Conversation[]
  convsLoading:        boolean

  // Active chat
  activeConvId:        string | null
  messages:            Message[]
  messagesLoading:     boolean
  typingUsers:         Record<string, boolean>  // { [uid]: isTyping } — derived from typingExpiresAt
  unreadCount:         Record<string, number>   // { [convId]: count }

  // Action state
  sendLoading:         boolean
  sendError:           string | null

  // Internal subscriptions
  _unsubConvs:         Unsubscribe | null
  _unsubMessages:      Unsubscribe | null
  _typingTimer:        ReturnType<typeof setTimeout> | null

  // Actions
  subscribeConversations:  (userId: string)       => void
  openConversation:        (orderId: string)       => Promise<string>
  subscribeMessages:       (convId: string, myUid: string) => void
  sendMessage:             (convId: string, text?: string, mediaUrl?: string, mediaType?: 'image' | 'document') => Promise<void>
  sendTyping:              (convId: string, uid: string, isTyping: boolean) => Promise<void>
  markRead:                (convId: string)        => Promise<void>
  unsubscribeAll:          ()                      => void
  clearError:              ()                      => void
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  conversations:    [],
  convsLoading:     false,
  activeConvId:     null,
  messages:         [],
  messagesLoading:  false,
  typingUsers:      {},
  unreadCount:      {},
  sendLoading:      false,
  sendError:        null,
  _unsubConvs:      null,
  _unsubMessages:   null,
  _typingTimer:     null,

  // ── subscribeConversations ─────────────────────────────────────────────────
  subscribeConversations: uid => {
    get()._unsubConvs?.()
    set({ convsLoading: true })

    const q = query(
      collection(firestore, 'conversations'),
      where('customerId',  '==', uid),
      orderBy('lastMessageAt', 'desc'),
    )
    // Also listen for provider conversations
    const q2 = query(
      collection(firestore, 'conversations'),
      where('providerId', '==', uid),
      orderBy('lastMessageAt', 'desc'),
    )

    const seen = new Map<string, Conversation>()

    const merge = () => {
      const sorted = Array.from(seen.values()).sort(
        (a, b) => {
          const ta = (a.lastMessageAt as unknown as { seconds: number })?.seconds ?? 0
          const tb = (b.lastMessageAt as unknown as { seconds: number })?.seconds ?? 0
          return tb - ta
        },
      )
      set({ conversations: sorted, convsLoading: false })
    }

    const unsub1 = onSnapshot(q, snap => {
      snap.docs.forEach(d => seen.set(d.id, { ...d.data(), id: d.id } as Conversation))
      merge()
    })
    const unsub2 = onSnapshot(q2, snap => {
      snap.docs.forEach(d => seen.set(d.id, { ...d.data(), id: d.id } as Conversation))
      merge()
    })

    set({ _unsubConvs: () => { unsub1(); unsub2() } })
  },

  // ── openConversation ──────────────────────────────────────────────────────
  openConversation: async orderId => {
    try {
      const fn  = httpsCallable<{ orderId: string }, { ok: boolean; conversationId: string }>(
        firebaseFunctions, 'getOrCreateConversation',
      )
      const res = await fn({ orderId })
      set({ activeConvId: res.data.conversationId })
      return res.data.conversationId
    } catch (err) {
      if (__DEV__) console.warn('[Messaging] openConversation error', err)
      return ''
    }
  },

  // ── subscribeMessages ─────────────────────────────────────────────────────
  subscribeMessages: (convId, myUid) => {
    get()._unsubMessages?.()
    set({ messagesLoading: true, messages: [], activeConvId: convId })

    const q = query(
      collection(firestore, 'conversations', convId, 'messages'),
      orderBy('sentAt', 'asc'),
      limit(MESSAGES_PAGE),
    )

    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Message))
      set({ messages: msgs, messagesLoading: false })

      // Track typing from the conversation doc
      const convRef = doc(firestore, 'conversations', convId)
      onSnapshot(convRef, convSnap => {
        if (!convSnap.exists()) return
        const data      = convSnap.data() as Conversation
        // TTL-based typing: derive isTyping from typingExpiresAt timestamps
        const expiresMap: Record<string, number> = data.typingExpiresAt ?? {}
        const now = Date.now()
        const typing: Record<string, boolean> = {}
        for (const [uid, expiresAt] of Object.entries(expiresMap)) {
          typing[uid] = expiresAt > now
        }
        // Legacy: also merge old boolean typingStatus if present (migration)
        const legacyTyping: Record<string, boolean> = data.typingStatus ?? {}
        for (const [uid, val] of Object.entries(legacyTyping)) {
          if (!(uid in typing)) typing[uid] = val  // only if not already set by TTL
        }
        const unread    = data.unreadCount  ?? {}
        // Remove own typing from display
        const othersTyping = Object.fromEntries(
          Object.entries(typing).filter(([uid]) => uid !== myUid),
        )
        set({
          typingUsers: othersTyping,
          unreadCount: unread,
        })
      })
    }, () => set({ messagesLoading: false }))

    set({ _unsubMessages: unsub })

    // Auto mark-read when opening
    void get().markRead(convId)
  },

  // ── sendMessage ───────────────────────────────────────────────────────────
  sendMessage: async (convId, text, mediaUrl, mediaType) => {
    set({ sendLoading: true, sendError: null })
    try {
      const fn = httpsCallable<{
        conversationId: string
        text?:     string
        mediaUrl?: string
        mediaType?: 'image' | 'document'
      }, { ok: boolean; messageId: string }>(
        firebaseFunctions, 'sendMessage',
      )
      await fn({ conversationId: convId, text, mediaUrl, mediaType })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إرسال الرسالة'
      set({ sendError: msg })
    } finally {
      set({ sendLoading: false })
    }
  },

  // ── sendTyping — TTL-based (1 write per burst, no delete) ───────────────
  //
  // OLD approach (2 writes per burst):
  //   write typingStatus.uid = true  → 1 write
  //   setTimeout 3s → write typingStatus.uid = false → 1 write
  //   Cost: ~2 writes / burst / user ≈ 40 writes/min at 20 bursts/min
  //
  // NEW approach (1 write per burst):
  //   write typingExpiresAt.uid = Date.now() + TTL_MS → 1 write
  //   No delete write — expiry checked client-side
  //   Cost: ~1 write / burst / user ≈ 20 writes/min (50% reduction)
  //   Stale cleanup: hourly CF removes entries > TTL_MS old
  //
  sendTyping: async (convId, uid, isTyping) => {
    const { _typingTimer } = get()
    if (_typingTimer) clearTimeout(_typingTimer)

    try {
      const convRef = doc(firestore, 'conversations', convId)

      if (isTyping) {
        // ── One write: set expiry timestamp ────────────────────────────────
        const expiresAt = Date.now() + TYPING_TTL_MS
        await updateDoc(convRef, { [`typingExpiresAt.${uid}`]: expiresAt })

        // ── Local timer: update typingUsers state when TTL expires ──────────
        // No Firestore write on expiry — just update local state
        const timer = setTimeout(() => {
          const { typingUsers } = get()
          if (typingUsers[uid]) {
            set({ typingUsers: { ...typingUsers, [uid]: false } })
          }
        }, TYPING_TTL_MS)
        set({ _typingTimer: timer, typingUsers: { ...get().typingUsers, [uid]: true } })
      } else {
        // Explicitly stopping: set expiry to the past (0) — still just 1 write
        await updateDoc(convRef, { [`typingExpiresAt.${uid}`]: 0 })
        set({ typingUsers: { ...get().typingUsers, [uid]: false } })
      }
    } catch { /* non-critical */ }
  },

  // ── markRead ──────────────────────────────────────────────────────────────
  markRead: async convId => {
    try {
      const fn = httpsCallable(firebaseFunctions, 'markRead')
      await fn({ conversationId: convId })
    } catch { /* non-critical */ }
  },

  // ── unsubscribeAll ────────────────────────────────────────────────────────
  unsubscribeAll: () => {
    get()._unsubConvs?.()
    get()._unsubMessages?.()
    const t = get()._typingTimer
    if (t) clearTimeout(t)
    set({
      _unsubConvs: null, _unsubMessages: null, _typingTimer: null,
      activeConvId: null, messages: [], typingUsers: {},
    })
  },

  clearError: () => set({ sendError: null }),
}))
