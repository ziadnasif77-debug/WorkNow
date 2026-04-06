// ─────────────────────────────────────────────────────────────────────────────
// Notifications Store
// • Registers FCM token with backend on app launch
// • Subscribes to /users/{uid}/notifications (realtime)
// • Handles deep-link routing when notification is tapped
// ─────────────────────────────────────────────────────────────────────────────

import { create }        from 'zustand'
import { httpsCallable } from 'firebase/functions'
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import * as ExpoNotifications from 'expo-notifications'
import { Platform }      from 'react-native'
import { firebaseFunctions, firestore } from '../lib/firebase'
import type { AppNotification } from '@workfix/types'

// ── Expo Notifications global handler config ──────────────────────────────────
import type { NotificationBehavior } from 'expo-notifications'

// setNotificationHandler is a no-op on web — guard to avoid Invariant Violation
if (Platform.OS !== 'web') {
  ExpoNotifications.setNotificationHandler({
    handleNotification: async (): Promise<NotificationBehavior> => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  })
}

interface NotificationsState {
  notifications:    AppNotification[]
  unreadCount:      number
  isLoading:        boolean
  permissionStatus: 'granted' | 'denied' | 'undetermined'
  _unsub:           Unsubscribe | null

  // Actions
  requestPermission:    ()               => Promise<boolean>
  registerToken:        ()               => Promise<void>
  subscribeNotifications:(uid: string)   => void
  markAsRead:           (notifId: string)=> Promise<void>
  markAllRead:          ()               => Promise<void>
  unsubscribe:          ()               => void

  // Navigation helper — returns route to push for a notification
  getRouteForNotif:     (notif: AppNotification) => { pathname: string; params?: Record<string, string> } | null
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications:    [],
  unreadCount:      0,
  isLoading:        false,
  permissionStatus: 'undetermined',
  _unsub:           null,

  // ── requestPermission ────────────────────────────────────────────────────
  requestPermission: async () => {
    // Android 13+ requires explicit permission
    const { status: existing } = await ExpoNotifications.getPermissionsAsync()
    if (existing === 'granted') {
      set({ permissionStatus: 'granted' })
      return true
    }
    const { status } = await ExpoNotifications.requestPermissionsAsync()
    set({ permissionStatus: status as 'granted' | 'denied' | 'undetermined' })
    return status === 'granted'
  },

  // ── registerToken ────────────────────────────────────────────────────────
  registerToken: async () => {
    try {
      const granted = await get().requestPermission()
      if (!granted) return

      // Expo push token (wraps FCM on Android, APNs on iOS)
      const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
        projectId: process.env['EXPO_PUBLIC_PROJECT_ID'],
      })
      const fcmToken = tokenData.data

      const fn = httpsCallable<{ fcmToken: string; platform: string }, { ok: boolean }>(
        firebaseFunctions, 'registerFcmToken',
      )
      await fn({
        fcmToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      })
    } catch (err) {
      console.warn('Failed to register FCM token', err)
    }
  },

  // ── subscribeNotifications ────────────────────────────────────────────────
  subscribeNotifications: uid => {
    get()._unsub?.()
    set({ isLoading: true })

    const q = query(
      collection(firestore, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50),
    )

    const unsub = onSnapshot(q, snap => {
      const notifs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification))
      const unread = notifs.filter(n => !n.isRead).length
      set({ notifications: notifs, unreadCount: unread, isLoading: false })
    }, () => set({ isLoading: false }))

    set({ _unsub: unsub })
  },

  // ── markAsRead ────────────────────────────────────────────────────────────
  markAsRead: async notifId => {
    const { notifications } = get()
    const notif = notifications.find(n => n.id === notifId)
    if (!notif || notif.isRead) return

    // Optimistic update
    set(s => ({
      notifications: s.notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n),
      unreadCount:   Math.max(0, s.unreadCount - 1),
    }))

    try {
      // We need userId — get from first notification or from auth
      const uid = notif.userId
      if (uid) {
        await updateDoc(
          doc(firestore, 'users', uid, 'notifications', notifId),
          { isRead: true },
        )
      }
    } catch { /* non-critical — optimistic update already applied */ }
  },

  // ── markAllRead ───────────────────────────────────────────────────────────
  markAllRead: async () => {
    const { notifications } = get()
    const unread = notifications.filter(n => !n.isRead)
    if (unread.length === 0) return

    // Optimistic update
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount:   0,
    }))

    // Batch write — Firestore batches support up to 500 ops
    try {
      const { writeBatch } = await import('firebase/firestore')
      const batch = writeBatch(firestore)
      unread.forEach(n => {
        if (n.userId) {
          batch.update(
            doc(firestore, 'users', n.userId, 'notifications', n.id),
            { isRead: true },
          )
        }
      })
      await batch.commit()
    } catch { /* non-critical */ }
  },

  // ── getRouteForNotif ─────────────────────────────────────────────────────
  getRouteForNotif: notif => {
    if (!notif.refId) return null

    switch (notif.refType) {
      case 'order':
        return { pathname: '/orders/[id]', params: { id: notif.refId } }
      case 'message':
        return { pathname: '/chat/[id]', params: { id: notif.refId } }
      case 'dispute':
        return { pathname: '/orders/[id]', params: { id: notif.refId } }
      case 'payment':
        return { pathname: '/orders/[id]', params: { id: notif.refId } }
      default:
        return null
    }
  },

  unsubscribe: () => {
    get()._unsub?.()
    set({ _unsub: null })
  },
}))
