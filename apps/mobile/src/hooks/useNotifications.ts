// ─────────────────────────────────────────────────────────────────────────────
// useNotifications — call once in RootLayout to wire everything up
// • Registers FCM token on mount
// • Listens for foreground notifications (shows in-app toast)
// • Listens for notification taps → navigates to correct screen
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import * as ExpoNotifications from 'expo-notifications'
import type { Subscription } from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useNotificationsStore } from '../stores/notificationsStore'
import { useAuthStore }          from '../stores/authStore'

export function useNotifications() {
  const router      = useRouter()
  const { firebaseUser }                  = useAuthStore()
  const { registerToken, subscribeNotifications, getRouteForNotif, unsubscribe } = useNotificationsStore()

  const foregroundSub = useRef<Subscription | null>(null)
  const tapSub        = useRef<Subscription | null>(null)

  useEffect(() => {
    if (!firebaseUser?.uid) return

    // 1. Register device token with backend
    void registerToken()

    // 2. Subscribe to in-app notification list
    subscribeNotifications(firebaseUser.uid)

    // 3. Handle foreground notifications (app is open)
    foregroundSub.current = ExpoNotifications.addNotificationReceivedListener(
      notification => {
        // The notification handler (set in store) already shows the alert.
        // Here we can additionally update badge or show in-app toast.
        const data = notification.request.content.data as {
          refId?: string; refType?: string
        }
        if (__DEV__) console.info('[Notif] foreground', data?.refType)
      },
    )

    // 4. Handle notification taps (app in background or closed)
    tapSub.current = ExpoNotifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data as {
          refId?: string
          refType?: 'order' | 'message' | 'dispute' | 'payment'
          type?: string
        }

        if (!data.refId || !data.refType) return

        // Build a mock AppNotification to reuse routing logic
        const mockNotif = {
          id:      '',
          userId:  firebaseUser.uid,
          type:    data.type as never,
          title:   { ar: '', en: '' },
          body:    { ar: '', en: '' },
          isRead:  true,
          refId:   data.refId,
          refType: data.refType,
          createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() },
        }

        const route = getRouteForNotif(mockNotif)
        if (route) {
          // Small delay to let the app fully open before navigating
          setTimeout(() => {
            router.push(route as never)
          }, 500)
        }
      },
    )

    // 5. Check if app was launched from a notification tap
    void ExpoNotifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return
      const data = response.notification.request.content.data as {
        refId?: string; refType?: string
      }
      if (data.refId && data.refType) {
        const mockNotif = {
          id: '', userId: firebaseUser.uid,
          type: '' as never, title: { ar: '', en: '' }, body: { ar: '', en: '' },
          isRead: true, refId: data.refId, refType: data.refType as never,
          createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() },
        }
        const route = getRouteForNotif(mockNotif)
        if (route) router.push(route as never)
      }
    })

    return () => {
      foregroundSub.current?.remove()
      tapSub.current?.remove()
      unsubscribe()
    }
  }, [firebaseUser?.uid])
}
