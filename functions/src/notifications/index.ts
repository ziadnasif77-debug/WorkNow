// ─────────────────────────────────────────────────────────────────────────────
// Notifications Functions
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, serverTimestamp } from '../_shared/helpers'
import * as admin from 'firebase-admin'

const registerFcmTokenSchema = z.object({
  fcmToken: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']),
})

export const registerFcmToken = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  const input = validate(registerFcmTokenSchema, data)

  await db.collection('users').doc(uid).update({
    fcmTokens: admin.firestore.FieldValue.arrayUnion(input.fcmToken),
    updatedAt: serverTimestamp(),
  })

  return { ok: true }
})

const updateNotificationPreferencesSchema = z.object({
  newOrder:      z.boolean().optional(),
  newMessage:    z.boolean().optional(),
  orderUpdates:  z.boolean().optional(),
  promotions:    z.boolean().optional(),
})

export const updateNotificationPreferences = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  const input = validate(updateNotificationPreferencesSchema, data)

  await db.collection('users').doc(uid).update({
    notificationPrefs: input,
    updatedAt: serverTimestamp(),
  })

  return { ok: true }
})
