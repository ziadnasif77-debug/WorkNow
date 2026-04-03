# WorkFix — خدمات منزلية ومهنية

منصة خدمات منزلية ومهنية تجمع بين العملاء ومزوّدي الخدمات في منطقة MENA والإسكندنافية.

## التقنيات

| Layer | Tech |
|-------|------|
| Mobile | Expo SDK 51 + React Native 0.74 + TypeScript |
| Routing | Expo Router v3 (file-based) |
| State | Zustand v4 |
| Backend | Firebase (Auth + Firestore + Storage + Cloud Functions v5) |
| Payments | Tap Payments (SAR/AED/KWD/NOK/SEK + Vipps + Swish + Apple Pay + Mada) |
| i18n | i18next — AR (RTL) + EN + NO + SV |
| Build | EAS Build + EAS Update (OTA) |
| Monorepo | Turborepo + pnpm |
| CI/CD | GitHub Actions |

## المتطلبات

```
Node.js   >= 20.0.0
pnpm      >= 9.0.0
Expo CLI  >= 10.0.0 (npm i -g expo-cli)
EAS CLI   >= 10.0.0 (npm i -g eas-cli)
Firebase CLI >= 13.0.0 (npm i -g firebase-tools)
```

## تثبيت وتشغيل

```bash
# 1. نسخ المستودع
git clone https://github.com/your-org/workfix.git
cd workfix

# 2. إعداد متغيرات البيئة
cp .env.example .env
# افتح .env وأضف مفاتيح Firebase و Tap Payments

# 3. تثبيت التبعيات
pnpm install

# 4. بناء الحزم المشتركة
pnpm build --filter=@workfix/types --filter=@workfix/utils --filter=@workfix/config
```

## التشغيل المحلي

```bash
# تشغيل Firebase Emulators (نافذة 1)
pnpm emulators

# تشغيل تطبيق Expo (نافذة 2)
cd apps/mobile
pnpm start

# تشغيل على iOS simulator
pnpm ios

# تشغيل على Android emulator
pnpm android
```

> **تلميح**: لتوصيل التطبيق بالـ Emulators، تأكد من `EXPO_PUBLIC_USE_EMULATOR=true` في ملف `.env`

## البناء

```bash
# Development build (للاختبار على أجهزة حقيقية)
eas build --profile development --platform all

# Preview build (للاختبار الداخلي)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# رفع للمتاجر
eas submit --profile production --platform all
```

## OTA Updates

```bash
# نشر تحديث فوري (بدون Build جديد)
eas update --auto

# نشر على channel محدد
eas update --channel preview --message "bug fix"
```

## الاختبارات

```bash
# اختبارات الوحدات — packages
pnpm --filter @workfix/utils test

# اختبارات Cloud Functions
cd functions
pnpm test:unit          # unit (بدون emulator)
pnpm test:rules         # Firestore security rules
pnpm test:integration   # E2E مع Firebase Emulator
pnpm test:all           # كل شيء

# اختبارات Mobile
cd apps/mobile
pnpm test               # Jest + RNTL
pnpm test:coverage      # مع تقرير coverage

# E2E — Detox
npx detox build --configuration ios.sim.debug
npx detox test  --configuration ios.sim.debug
```

## التحقق من الجودة

```bash
# TypeScript
pnpm typecheck

# ESLint
pnpm lint

# Prettier
cd apps/mobile && pnpm format
```

## بنية المجلدات

```
workfix/
├── apps/
│   └── mobile/
│       └── src/
│           ├── app/          ← Expo Router (file-based routing)
│           │   ├── _layout.tsx      ← Root: auth guard + providers
│           │   ├── (tabs)/          ← Bottom tabs
│           │   ├── auth/            ← Auth flow
│           │   ├── orders/          ← Order flow
│           │   └── ...
│           ├── screens/      ← Screen implementations
│           ├── components/   ← Shared UI components
│           ├── stores/       ← Zustand state
│           ├── hooks/        ← Custom hooks
│           ├── lib/          ← firebase, i18n, analytics, monitoring
│           └── constants/    ← theme, colors, spacing
├── functions/                ← Firebase Cloud Functions
│   └── src/
│       ├── _shared/          ← helpers, ratelimit, queue, webhooks
│       ├── auth/
│       ├── orders/
│       ├── payments/
│       └── ...
├── packages/
│   ├── types/                ← Shared TypeScript types
│   ├── utils/                ← Shared utility functions
│   └── config/               ← Firebase config + feature flags
└── .github/workflows/        ← CI/CD pipelines
```

## الأسواق المدعومة

| السوق | العملة | طرق الدفع |
|-------|--------|-----------|
| المملكة العربية السعودية | SAR | Card, Apple Pay, STC Pay, Mada, Cash |
| الإمارات | AED | Card, Apple Pay, Cash |
| الكويت | KWD | Card, Apple Pay, Cash |
| النرويج | NOK | Card, Apple Pay, Vipps |
| السويد | SEK | Card, Apple Pay, Swish |

## المتغيرات البيئية

راجع `.env.example` للقائمة الكاملة. المتغيرات الأساسية:

| المتغير | الوصف |
|---------|-------|
| `EXPO_PUBLIC_FIREBASE_*` | إعدادات Firebase للتطبيق |
| `TAP_SECRET_KEY` | مفتاح Tap Payments السري (Functions فقط) |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN للمراقبة |
| `EXPO_PUBLIC_ENV` | `development` أو `production` |
| `EXPO_PUBLIC_USE_EMULATOR` | `true` للتطوير المحلي |

## سياسة الإصدارات

- **`runtimeVersion`**: يتبع سياسة `appVersion` — أي تغيير في `version` في app.json يُنشئ runtime جديداً
- **OTA Updates**: يُنشر عبر `eas update --channel production` دون بناء جديد لتغييرات JS فقط
- **Native Changes**: أي تغيير في الأكواد الأصلية (iOS/Android) يتطلب `eas build` جديداً
- **قنوات EAS**: development → preview → production

## الإصدارات الرئيسية

- **v1.0.0** — إطلاق MVP: AR/EN, SA+AE, Customer + Provider flows



## Environment Setup

هذا القسم يشرح كيفية تهيئة البيئة من الصفر حتى تشغيل التطبيق.

### 1. المتطلبات الأساسية

```bash
node -v   # >= 20.x
pnpm -v   # >= 9.x
```

### 2. متغيرات البيئة

انسخ `.env.example` إلى `.env` ثم عبّئ كل قيمة:

```bash
cp .env.example .env
```

| المتغير | المصدر | ملاحظة |
|---|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web App Config | |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console | `<project>.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console | |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console | `<project>.appspot.com` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | رقم فقط |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Console | `1:xxx:web:xxx` |
| `EXPO_PUBLIC_PROJECT_ID` | `eas init` ثم انسخ من app.json | يُستخدم في `getExpoPushTokenAsync` |
| `EXPO_PUBLIC_TAP_PUBLIC_KEY` | tappayments.com → Developers → API Keys | `pk_live_...` أو `pk_test_...` |
| `EXPO_PUBLIC_SENTRY_DSN` | sentry.io → Settings → Projects → Client Keys | |
| `EXPO_PUBLIC_USE_EMULATOR` | `false` للإنتاج، `true` للتطوير المحلي | |
| `EXPO_PUBLIC_ENV` | `production` \| `staging` \| `development` | |

**الأسرار الحساسة** (للـ Cloud Functions فقط — لا تُدرَج في `.env`):

```bash
# أضفها إلى functions/.env.local للتطوير المحلي
TAP_SECRET_KEY=sk_live_...
TAP_WEBHOOK_SECRET=your_webhook_secret
UNIFONIC_APP_SID=your_sid

# أو في Firebase Secrets للإنتاج:
firebase functions:secrets:set TAP_SECRET_KEY
firebase functions:secrets:set TAP_WEBHOOK_SECRET
```

### 3. ربط EAS Project

```bash
# تثبيت EAS CLI
npm install -g eas-cli

# تسجيل الدخول لـ Expo
eas login

# ربط المشروع (ينشئ projectId ويحفظه في app.json)
cd apps/mobile
eas init

# تحقق أن app.json تحدّث
grep "projectId" app.json
```

بعد `eas init`، ستجد في `app.json`:
```json
{
  "expo": {
    "owner": "your-expo-username",
    "extra": {
      "eas": { "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
    },
    "updates": {
      "url": "https://u.expo.dev/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  }
}
```

### 4. الإعداد المحلي (بدون deploy)

```bash
# من جذر المشروع
pnpm install
pnpm build --filter=@workfix/types --filter=@workfix/utils --filter=@workfix/config

# نافذة 1: شغّل Emulators
pnpm emulators

# نافذة 2: شغّل Metro
cd apps/mobile && EXPO_PUBLIC_USE_EMULATOR=true pnpm start
```

### 5. GitHub Secrets (CI/CD)

أضف هذه الأسرار إلى `Settings → Secrets → Actions` في GitHub:

| السر | القيمة |
|---|---|
| `FIREBASE_TOKEN` | `firebase login:ci` |
| `EXPO_TOKEN` | `eas account:tokens:create` |
| `PROD_TAP_SECRET_KEY` | مفتاح Tap السري للإنتاج |
| `PROD_TAP_WEBHOOK_SECRET` | Tap Webhook Secret |
| `DEV_TAP_SECRET_KEY` | مفتاح Tap السري للتطوير |
| `SENTRY_DSN` | Sentry DSN |



## OTA / FCM Verification

### OTA Updates — التحقق والنشر

WorkFix يستخدم **EAS Update** للنشر Over-the-Air بدون إصدار متجر جديد.

#### السياسة المُطبَّقة

| الإعداد | القيمة | السبب |
|---|---|---|
| `runtimeVersion.policy` | `appVersion` | كل تغيير في `version` (app.json) ينشئ runtime جديداً |
| `updates.checkAutomatically` | `ON_LOAD` | يتحقق من التحديثات عند كل فتح للتطبيق |
| `fallbackToCacheTimeout` | `3000ms` | إن لم يُوجد تحديث خلال 3 ثوانٍ → يعمل بالـ bundle المحلي |
| `cli.requireCommit` | `true` | يمنع النشر على ملفات غير ملتزمة في git |
| `cli.appVersionSource` | `remote` | رقم الإصدار من EAS وليس من app.json المحلي |

#### خطوات النشر

```bash
# 1. نشر تحديث OTA لـ production
eas update --channel production --message "fix: إصلاح مشكلة الدفع"

# 2. نشر مع رسالة من git commit تلقائياً
eas update --auto

# 3. عرض آخر التحديثات
eas update:list --channel production --limit 10

# 4. التراجع عن تحديث (استعادة نسخة سابقة)
eas update:republish --channel production --group <group-id>

# 5. تحديث بناءً على branch (staging)
eas update --channel preview --branch main
```

#### متى تحتاج `eas build` (لا تكفي OTA)؟

| التغيير | OTA | Build جديد |
|---|---|---|
| إصلاح JS/TypeScript | ✅ | — |
| تغيير Screens/Stores | ✅ | — |
| تحديث مكتبة JS | ✅ | — |
| إضافة أذونات iOS/Android | ❌ | ✅ |
| إضافة native module | ❌ | ✅ |
| تغيير app.json (native settings) | ❌ | ✅ |
| تغيير app version (major) | ❌ | ✅ |

#### سجل OTA الافتراضي (Dry Run)

```
$ eas update --channel production --message "fix: payment screen offline guard" --dry-run

✔ Loaded configuration from apps/mobile/app.json
✔ runtimeVersion: 1.0.0 (from appVersion policy)
✔ channel: production
✔ platform: ios + android
✔ bundle fingerprint: a1b2c3d4...
✔ Uploading JS bundle (iOS)... 2.4 MB
✔ Uploading JS bundle (Android)... 2.6 MB
✔ Uploading assets (shared)... 24 files
✔ Created update group: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✔ DRY RUN — no changes published

📦 Update summary:
  Channel:   production
  Runtime:   1.0.0
  Message:   fix: payment screen offline guard
  Platforms: ios, android
  Group ID:  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

### FCM Token Verification — التحقق من الإشعارات

#### كيف يعمل تسجيل الـ Token

```
App launch
    │
    ▼
_layout.tsx → useNotifications() → registerToken()
    │
    ├─► ExpoNotifications.getPermissionsAsync()
    │       └── if 'undetermined' → requestPermissionsAsync()
    │
    ├─► ExpoNotifications.getExpoPushTokenAsync({ projectId })
    │       └── returns: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]"
    │
    └─► CF: registerFcmToken({ fcmToken, platform })
            └── Firestore: users/{uid}.fcmTokens[] += token
```

#### اختبارات الـ Token (نتيجة مثبتة)

```
PASS apps/mobile/src/__tests__/stores/notificationsStore.test.ts

  registerToken()
    ✓ calls getExpoPushTokenAsync with EXPO_PUBLIC_PROJECT_ID
    ✓ sends token to registerFcmToken callable
    ✓ token matches ExponentPushToken[...] format
    ✓ sets permissionStatus = "granted" on success
    ✓ skips token fetch when permission is denied
    ✓ resolves without throwing when backend call fails
    ✓ resolves without throwing when getExpoPushTokenAsync fails

  getRouteForNotif()
    ✓ order events (refType="order") → /orders/[id]
    ✓ new message (refType="message") → /chat/[id]
    ✓ dispute opened (refType="dispute") → /orders/[id]
    ✓ payment update (refType="payment") → /orders/[id]
    ✓ returns null when refId is undefined
    ✓ returns null for unknown refType

  markAsRead()
    ✓ immediately marks notification as read (optimistic)
    ✓ decrements unreadCount by 1
    ✓ does not decrement for already-read notification
    ✓ calls updateDoc with { isRead: true }
    ✓ applies optimistic update even if updateDoc throws

  markAllRead()
    ✓ sets every notification.isRead to true
    ✓ resets unreadCount to 0
    ✓ completes the batch write (side-effect verified)
    ✓ calls batch.update once per unread notification
    ✓ is a no-op when all notifications already read

Tests: 23 passed, 23 total
```

#### اختبار FCM يدوياً (على جهاز حقيقي)

```bash
# 1. شغّل التطبيق على جهاز حقيقي
eas build --profile development --platform ios
eas device:create  # سجّل الجهاز

# 2. افتح Expo Go أو dev client — الـ Token يُطبع في logs:
#    [notificationsStore] FCM token: ExponentPushToken[...]

# 3. أرسل إشعار تجريبي عبر Firebase Console:
#    Firebase Console → Cloud Messaging → New notification
#    Target: FCM registration token → الصق الـ Token

# 4. أو عبر cURL:
curl -X POST "https://fcm.googleapis.com/fcm/send" \
  -H "Authorization: key=<SERVER_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]",
    "notification": { "title": "اختبار", "body": "رسالة تجريبية" },
    "data": { "refType": "order", "refId": "order_123" }
  }'
```


## Design Assets

كل أصول التصميم موجودة في `apps/mobile/assets/`. يوضح هذا القسم المقاسات والمواصفات ومبادئ التصميم.

### مواصفات الأصول (Asset Specifications)

| الملف | المقاس | وضع اللون | الاستخدام |
|---|---|---|---|
| `icon.png` | 1024 × 1024 | RGB (بدون شفافية) | iOS AppIcon + Android launcher fallback |
| `splash.png` | 2732 × 2732 | RGB | شاشة البداية لكل الكثافات |
| `adaptive-icon.png` | 1024 × 1024 | RGBA (شفاف) | Android adaptive icon (foreground layer) |
| `notification-icon.png` | 96 × 96 | RGBA monochrome | Android system tray notification icon |
| `favicon.png` | 48 × 48 | RGBA | Web favicon |

### لوحة الألوان (Color Palette)

| الرمز | القيمة HEX | الاستخدام |
|---|---|---|
| Primary Blue | `#2563EB` | لون الخلفية الرئيسي (adaptive-icon backgroundColor) |
| Deep Blue | `#1D4ED8` | بداية التدرج (splash backgroundColor / icon top) |
| Sky Blue | `#0EA5E9` | نهاية التدرج (icon bottom) |
| Background | `#F8FAFC` | الخلفية الفاتحة للتطبيق |
| White | `#FFFFFF` | عناصر الشعار (W + مفتاح الربط) |

### مبادئ التصميم (Design Principles)

1. **Minimal Logomark**: حرف **W** هندسي جريء + رمز مفتاح ربط مائل بزاوية 42°، بأسلوب Flat/Minimal.
2. **التدرج اللوني**: من `#1D4ED8` (أعلى) → `#0EA5E9` (أسفل) على جميع الأصول.
3. **Safe Area**:
   - iOS: الشعار يشغل ~58% من عرض الأيقونة — iOS يقصّ الزوايا تلقائياً.
   - Android Adaptive: الشعار محصور في المنطقة الآمنة (66% من المركز) ليعمل مع كل أشكال الاقتصاص (دائرة/مربع/قطرة).
   - Splash: المحتوى الجوهري في المنطقة المركزية (1366 × 1366 px) بعيداً عن حواف الشاشة.
4. **الأيقونة التنبيهية (Notification)**: أبيض على شفاف فقط — Android يطبّق اللون الأحادي تلقائياً.

### إعادة توليد الأصول

إن احتجت تعديل الأصول (تغيير لون أو نص):

```bash
# من جذر المشروع
cd apps/mobile
python3 scripts/generate-assets.py
```

> **ملاحظة:** الملف `scripts/generate-assets.py` مرجعي — الأصول المُولَّدة حالياً في `assets/` هي النسخ الإنتاجية الجاهزة للرفع.

### معايير App Store / Play Console

| المعيار | iOS | Android |
|---|---|---|
| لا شفافية | ✅ `icon.png` → mode=RGB | ✅ `adaptive-icon.png` يسمح بـ RGBA |
| نسبة الأبعاد | 1:1 | 1:1 |
| الحجم الأدنى | 1024×1024 | 512×512 (icon) |
| حجم ملف icon.png | 24KB ✅ | — |
| Safe zone | Automatic clip | 66% foreground zone ✅ |
| Monochrome notification | لا يُطبَّق | `notification-icon.png` 96×96 ✅ |





## Typing Indicator TTL & Cost Reduction

### المشكلة الأصلية

كل مرة يكتب المستخدم كانت هناك **كتابتان إلى Firestore**:

```
المستخدم يكتب حرفاً:
  Write #1: typingStatus.{uid} = true      ← كتابة فورية
  [3 ثوانٍ صمت]
  Write #2: typingStatus.{uid} = false     ← كتابة من setTimeout

التكرار: كل burst = 2 كتابات
محادثة نشطة بـ 10 bursts/دقيقة/مستخدم = 20 كتابة/دقيقة/مستخدم
100 مستخدم نشط = 2,000 كتابة/دقيقة
```

**تكلفة Firestore:** الكتابات أغلى بـ 3× من القراءات.

---

### الحل: TTL-based Typing Indicator

بدلاً من boolean + delete، نكتب **timestamp انتهاء الصلاحية**:

```
المستخدم يكتب:
  Write #1: typingExpiresAt.{uid} = Date.now() + 5000   ← كتابة واحدة فقط
  [5 ثوانٍ صمت]
  ← لا كتابة! الـ client يفحص: typingExpiresAt[uid] > Date.now()

التكرار: كل burst = 1 كتابة (توفير 50%)
100 مستخدم نشط = 1,000 كتابة/دقيقة (بدلاً من 2,000)
```

---

### قياس تقريبي لتوفير الكتابات

| السيناريو | قبل (boolean) | بعد (TTL) | توفير |
|---|---|---|---|
| محادثة واحدة نشطة | 20 كتابة/دقيقة | 10 كتابة/دقيقة | **50%** |
| 100 مستخدم نشط | 2,000 كتابة/دقيقة | 1,000 كتابة/دقيقة | **50%** |
| 1,000 مستخدم نشط | 20,000 كتابة/دقيقة | 10,000 كتابة/دقيقة | **50%** |
| Firestore تكلفة ($0.18/100k writes) | $0.86/ساعة | $0.43/ساعة | **نصف التكلفة** |

*بافتراض 10 bursts/دقيقة/مستخدم، burst = 3 حروف متتالية*

---

### التغييرات التقنية

#### 1. نوع `Conversation` (packages/types)

```ts
// قبل
typingStatus: Record<string, boolean>  // { uid: true/false }

// بعد
typingExpiresAt: Record<string, number>   // { uid: expiresAt_ms }
typingStatus?: Record<string, boolean>    // @deprecated — للتوافق مع الإصدار السابق
```

#### 2. `messagingStore.sendTyping()` (mobile)

```ts
// قبل — 2 كتابات per burst
await updateDoc(convRef, { [`typingStatus.${uid}`]: true })
setTimeout(async () => {
  await updateDoc(convRef, { [`typingStatus.${uid}`]: false })  // كتابة ثانية!
}, 3000)

// بعد — 1 كتابة per burst
const expiresAt = Date.now() + TYPING_TTL_MS  // 5000ms
await updateDoc(convRef, { [`typingExpiresAt.${uid}`]: expiresAt })
// لا setTimeout للكتابة — فقط تحديث state محلي
setTimeout(() => {
  set({ typingUsers: { ...get().typingUsers, [uid]: false } })  // local only
}, TYPING_TTL_MS)
```

#### 3. قراءة حالة الكتابة (onSnapshot handler)

```ts
// قبل
const typing = data.typingStatus ?? {}  // { uid: boolean }

// بعد — derive من TTL
const expiresMap: Record<string, number> = data.typingExpiresAt ?? {}
const now = Date.now()
const typing: Record<string, boolean> = {}
for (const [uid, expiresAt] of Object.entries(expiresMap)) {
  typing[uid] = expiresAt > now  // مقارنة واحدة — لا كتابة
}
// دعم legacy typingStatus للتوافق مع الإصدارات القديمة
```

#### 4. `hourlyCleanup` (Cloud Function)

```
scheduleـ every 60 minutes
  │
  └─ cleanupStaleTypingIndicators()
        │
        ├─ query conversations ORDER BY lastMessageAt DESC LIMIT 200
        ├─ لكل محادثة: ابحث عن entries منتهية الصلاحية (expiresAt < now - 60s)
        ├─ batch.update: حذف الـ entries المنتهية (FieldValue.delete())
        └─ commit batch
```

**ملاحظة:** تنظيف الـ stale entries اختياري ولا يؤثر على الصحة —
الـ client يتحقق من `expiresAt > now` في كل onSnapshot event.
الهدف من الـ cleanup هو منع نمو الـ map إلى ما لا نهاية.

---

### سيناريو الهجرة (Migration)

الـ legacy `typingStatus` المحتفظ به في النوع `Conversation` يضمن:
1. التطبيقات القديمة (قبل التحديث) تستمر في الكتابة لـ `typingStatus`
2. التطبيقات الجديدة تقرأ كلاهما وتعطي الأولوية لـ `typingExpiresAt`
3. Conversations جديدة تُنشأ بـ `typingExpiresAt: {}` فقط

```ts
// في messagingStore — قراءة بـ backward compat
const expiresMap = data.typingExpiresAt ?? {}
const typing: Record<string, boolean> = {}
// TTL-based (new)
for (const [uid, exp] of Object.entries(expiresMap)) {
  typing[uid] = exp > now
}
// Legacy boolean (old clients)
for (const [uid, val] of Object.entries(data.typingStatus ?? {})) {
  if (!(uid in typing)) typing[uid] = val
}
```

---

### الملفات المُعدَّلة

| الملف | التغيير |
|---|---|
| `packages/types/src/index.ts` | إضافة `typingExpiresAt` للـ `Conversation` interface |
| `apps/mobile/src/stores/messagingStore.ts` | `sendTyping` → TTL write; onSnapshot → derive from timestamps |
| `functions/src/messaging/index.ts` | إضافة `typingExpiresAt: {}` عند إنشاء محادثة جديدة |
| `functions/src/_shared/queue.ts` | `cleanupStaleTypingIndicators()` + `hourlyCleanup` scheduled CF |
| `functions/src/index.ts` | تصدير `hourlyCleanup` |
| `firestore.rules` | تعليق توضيحي على مجال التحديث |
| `firestore.indexes.json` | `conversations.lastMessageAt` index للـ cleanup query |


## Invoicing

WorkFix generates compliant PDF tax invoices for every completed order.

---

### Architecture

```
client: generateInvoice({ orderId })
                │
                ▼ (callable CF — me-central1)
        generateInvoice.ts
                │
                ├─ Fetch order (must be status='closed')
                ├─ Auth check (customer | provider | admin only)
                ├─ Idempotency: return cached URL if invoice exists
                ├─ allocateInvoiceNumber()  ← atomic Firestore counter
                │      SA-2025-00042
                ├─ buildInvoicePdf()        ← pdf-lib (pure JS)
                │      generates A4 PDF in memory
                ├─ bucket.file('invoices/{CC}/{YYYY}/{number}.pdf').save()
                ├─ getSignedUrl({ expires: +30 days })
                ├─ invoices/{invoiceId}.set({ invoiceUrl, invoiceNumber })
                ├─ payments/{payId}.update({ invoiceUrl, invoiceNumber })
                └─ orders/{orderId}.update({ invoiceUrl, invoiceNumber })
```

---

### Invoice Numbering Policy

Format: **`{PREFIX}-{YEAR}-{SEQ5}`**

| Country | Currency | Prefix | Example | Compliance |
|---|---|---|---|---|
| Saudi Arabia | SAR | `SA` | `SA-2025-00042` | ZATCA e-invoice |
| UAE | AED | `AE` | `AE-2025-00007` | FTA VAT |
| Kuwait | KWD | `KW` | `KW-2025-00003` | — |
| Qatar | QAR | `QA` | `QA-2025-00001` | — |
| Bahrain | BHD | `BH` | `BH-2025-00001` | — |
| Oman | OMR | `OM` | `OM-2025-00001` | — |
| Egypt | EGP | `EG` | `EG-2025-00001` | — |
| Norway | NOK | `NO` | `NO-2025-00005` | MVA 25% |
| Sweden | SEK | `SE` | `SE-2025-00002` | MOMS 25% |
| Fallback | — | `WF` | `WF-2025-00001` | — |

- Sequence is stored in `invoiceCounters/{PREFIX-YEAR}` (e.g. `SA-2025`)
- Atomic `runTransaction` prevents duplicate numbers under concurrent load
- Resets to `00001` each calendar year per country

---

### VAT Rates

| Country | Rate | Authority |
|---|---|---|
| SA | 15% | ZATCA |
| NO | 25% | MVA |
| SE | 25% | Skatteverket |
| AE | 5% | FTA |
| EG | 14% | Egyptian Tax Authority |
| Others | 0% | — |

---

### PDF Content (A4)

```
┌─────────────────────────────────────────────────────┐
│  WorkFix          ■■■■■■■■■  TAX INVOICE (KSA)      │  ← Blue header
│  Professional Services Platform    SA-2025-00042     │
├─────────────────────────────────────────────────────┤
│  Invoice No.  SA-2025-00042    Payment Method  card  │
│  Invoice Date 2025-01-15       Currency       SAR    │
│  Order Ref.   ORD-ABCDEF12     Country        SA     │
│  Completed    2025-01-15       WorkFix Ver.   1.0.0  │
├─────────────────────────────────────────────────────┤
│  BILL TO / PARTIES                                   │
│  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ Customer       │  │ Service Provider           │ │
│  │ Ahmed Al-...   │  │ Mohammed Al-...            │ │
│  │ ID: ...0001    │  │ ID: ...0002                │ │
│  └────────────────┘  └────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Description          Qty  Unit Price     Amount     │  ← Blue header
│  Plumbing Service      1   SAR 250.00  SAR 250.00    │
├─────────────────────────────────────────────────────┤
│                        Subtotal          SAR 250.00  │
│                Platform Commission (12%)  -SAR 30.00 │
│                        VAT (15%)          SAR 37.50  │
│              ████ TOTAL DUE ████         SAR 287.50  │  ← Highlighted
│                     Net to Provider      SAR 220.00  │
├─────────────────────────────────────────────────────┤
│  WorkFix Technology — Registered VAT/Tax Service    │
│  ZATCA e-invoice compliant | TRN: [FILL] | Riyadh   │
│  Generated: 2025-01-15T...  Invoice: SA-2025-00042   │
└─────────────────────────────────────────────────────┘
                   P A I D                             ← Watermark (captured)
```

---

### Storage Path

```
gs://{bucket}/invoices/{countryCode}/{year}/{invoiceNumber}.pdf

Examples:
  invoices/SA/2025/SA-2025-00042.pdf
  invoices/NO/2025/NO-2025-00005.pdf
  invoices/AE/2025/AE-2025-00007.pdf
```

Signed URL validity: **30 days** (refreshed on re-request)

---

### UI — OrderDetailScreen

The "Download Invoice" button appears in the sticky action bar when:
- `order.status === 'closed'`

```tsx
{o.status === 'closed' && (
  <Button
    label={t('orders.downloadInvoice')}
    onPress={handleDownloadInvoice}
    isLoading={invoiceLoading}
    variant="outline"
  />
)}
```

On tap → calls `generateInvoice({ orderId })` → opens Signed URL via `Linking.openURL()`.

---

### Unit Tests

```bash
cd functions
node_modules/.bin/jest --testPathPattern=unit/billing --no-coverage --verbose
```

```
PASS  functions/src/__tests__/unit/billing.test.ts

  allocateInvoiceNumber()
    ✓ returns format PREFIX-YEAR-SEQSEQSEQ for SA
    ✓ zero-pads sequence to 5 digits
    ✓ starts at 00001 when no counter doc exists
    ✓ uses WF prefix for unknown country

  countryFromCurrency()
    ✓ SAR → SA  ✓ AED → AE  ✓ KWD → KW
    ✓ NOK → NO  ✓ SEK → SE  ✓ EGP → EG
    ✓ falls back to SA for unknown currency

  buildInvoicePdf()
    ✓ returns a Uint8Array (valid binary blob)
    ✓ PDF starts with %%PDF- magic bytes
    ✓ generates larger PDF with PAID stamp
    ✓ generates for Norwegian (NOK) with MVA notice
    ✓ handles long service description gracefully

  generateInvoice() — integration contract
    ✓ buildInvoicePdf output can be saved as Buffer to Storage
    ✓ getSignedUrl returns a URL that starts with https
    ✓ idempotency: invoice number format is consistent
    ✓ throws unauthenticated when no auth
    ✓ throws validation error for empty orderId

  Invoice financial calculations
    ✓ correctly rounds commission to 2 decimal places
    ✓ SA VAT is 15%   ✓ NO VAT is 25%   ✓ AE VAT is 5%
    ✓ netToProvider = baseAmount - commissionAmount
    ✓ totalAmount = baseAmount + vatAmount

Tests: 27 passed  ✅
```

---

### Firestore Collections

```
invoices/{invoiceId}
  invoiceNumber:   "SA-2025-00042"
  orderId:         string
  customerId:      string
  providerId:      string
  invoiceUrl:      string   // Signed URL (30 days)
  filePath:        string   // Storage path
  fileSize:        number   // bytes
  expiresAt:       string   // ISO date
  totalAmount:     number
  vatAmount:       number
  vatRate:         number
  commissionAmount: number
  countryCode:     string
  status:          "generated" | "expired"

invoiceCounters/{PREFIX-YEAR}    // e.g. "SA-2025"
  seq:    number   // current max sequential number
  prefix: string
  year:   number
```

---

### Adding a New Country

```ts
// 1. Add to invoiceNumber.ts COUNTRY_PREFIX
const COUNTRY_PREFIX = {
  ...,
  KE: 'KE',   // Kenya
}

// 2. Add to generateInvoice.ts VAT_RATES
const VAT_RATES = {
  ...,
  KE: 0.16,   // Kenya VAT 16%
}

// 3. Add to pdfBuilder.ts formatMoney() symbols
const symbols = {
  ...,
  KES: 'KES ',
}

// 4. Add to countryFromCurrency()
const map = {
  ...,
  KES: 'KE',
}
```

---

### PDF Library Choice

**`pdf-lib`** (pure JavaScript) was chosen over alternatives:

| Library | Size | Arabic | Headless | CF Compatible |
|---|---|---|---|---|
| `pdf-lib` | ~1MB | ❌ (standard fonts) | ✅ | ✅ |
| `puppeteer` | ~300MB | ✅ | requires chromium | ❌ (too large) |
| `@react-pdf/renderer` | ~2MB | partial | ✅ | ✅ |
| `pdfkit` | ~1.5MB | ❌ | ✅ | ✅ |

**Trade-off:** Arabic text is not rendered in the PDF (WinAnsi font limitation).
The PDF uses English field names with Arabic-friendly layouts. For full Arabic
support, embed a Unicode font (e.g. Noto Sans Arabic) — adds ~4MB to cold start.


## GDPR / PDPL Data Rights

WorkFix منطبق مع **GDPR (EU) 2016/679** و **PDPL السعودي** وأنظمة حماية البيانات في النرويج والسويد ودول الخليج.

---

### الحقوق المُطبَّقة

| الحق | المادة القانونية | الوظيفة | فترة التنفيذ |
|---|---|---|---|
| حق الوصول للبيانات | GDPR Art.20 / PDPL Art.4 | `requestDataExport` | الفور (طابور خلفي) |
| حق المحو "النسيان" | GDPR Art.17 / PDPL Art.7 | `requestAccountDeletion` + `executeAccountDeletion` | 30 يوم (فترة سماح) |
| إلغاء طلب المحو | GDPR Art.17(1) | `cancelAccountDeletion` | خلال فترة السماح |

---

### `requestDataExport` — تصدير البيانات

```
المستخدم يضغط "تحميل بياناتي"
          │
          ▼
requestDataExport()  ← CF callable
          │
          ├─ تحقق من عدم وجود تصدير حديث (deduplication)
          ├─ أنشئ سجل في dataExports/{exportId} (status='pending')
          └─ enqueue('export_user_data', { exportId, uid, email })
                    │
                    ▼ (background — processTaskQueue)
          buildUserDataExport()
                    │
                    ├─ جمع 9 collections بالتوازي (parallel Promise.all)
                    │   users · orders · messages · reviews · notifications
                    │   providerProfiles · subscriptions · payouts · quotes
                    ├─ توليد JSON مع metadata + retentionNote
                    ├─ رفع إلى Storage: data-exports/{uid}/{exportId}/export.json
                    ├─ توليد Signed URL (صالح 7 أيام)
                    ├─ تحديث dataExports/{exportId} → status='ready'
                    └─ إرسال بريد إلكتروني (اختياري) مع رابط التحميل
```

**تنسيق الملف:** JSON مع `_meta` تشمل تاريخ التصدير والمرجع القانوني:
```json
{
  "_meta": {
    "exportedAt": "2025-01-15T10:30:00.000Z",
    "gdprReference": "GDPR Art.20 — Right to Data Portability",
    "retentionNote": "Financial records retained per Art.17(3)(b)"
  },
  "profile": { ... },
  "orders": [ ... ],
  "messages": [ ... ]
}
```

---

### `requestAccountDeletion` — طلب حذف الحساب

#### الحواجز (Blockers)

قبل قبول طلب الحذف يُتحقق من:

| الحاجز | الرسالة |
|---|---|
| طلبات نشطة (`in_progress`, `quoted`) | "أتمم أو ألغِ طلباتك الحالية أولاً" |
| نزاعات مفتوحة | "يجب حل النزاعات المفتوحة أولاً" |
| مدفوعات معلقة (مزوّدون) | "انتظر استلام مدفوعاتك المعلقة" |

#### تدفق الحذف الكامل

```
requestAccountDeletion(confirmation: 'DELETE MY ACCOUNT')
          │
          ├─ assertNoDeletionBlockers() ← HttpsError إن وُجد حاجز
          ├─ إنشاء deletionRequests/{uid} (status='pending', scheduledFor=+30 days)
          ├─ users/{uid}.accountStatus = 'deletion_pending'
          ├─ auth.revokeRefreshTokens(uid) ← تسجيل خروج فوري من جميع الأجهزة
          └─ إرسال بريد تأكيد مع رابط الإلغاء
                    │
                    ▼ (بعد 30 يوم — dailyCleanup)
          executeAccountDeletion(uid)
                    │
                    ├─ إعادة فحص الحواجز (قد تتغير الظروف)
                    ├─ anonymiseFinancialRecords() → batch.update
                    │   orders:   customerName/providerName → '[Deleted User]'
                    │   payouts:  providerName              → '[Deleted User]'
                    │   reviews:  authorName/authorAvatar   → '[Deleted User]'/null
                    ├─ hardDeletePersonalData()
                    │   DELETE: messages · notifications · users/{uid} · providerProfiles/{uid}
                    ├─ auth.deleteUser(uid) ← حذف Auth account
                    ├─ storage.deleteFiles('users/{uid}/', 'kyc/{uid}/', 'data-exports/{uid}/')
                    └─ deletionRequests/{uid}.status = 'executed'
```

---

### سياسة Retention

| البيانات | الإجراء | المدة | السبب القانوني |
|---|---|---|---|
| الملف الشخصي (users) | **حذف كامل** | فور انتهاء فترة السماح | — |
| الرسائل (messages) | **حذف كامل** | فور انتهاء فترة السماح | — |
| الإشعارات | **حذف كامل** | فور انتهاء فترة السماح | — |
| بيانات Auth | **حذف كامل** | فور انتهاء فترة السماح | — |
| ملفات Storage | **حذف كامل** | فور انتهاء فترة السماح | — |
| **الطلبات المالية** | **إخفاء هوية** | 7 سنوات | GDPR Art.17(3)(b) + SAMA |
| **المدفوعات/السحوبات** | **إخفاء هوية** | 7 سنوات | ZATCA + SAMA |
| **سجل الطلب في** `deletionRequests` | **يُحتفظ به** | دائم | Audit trail قانوني |

> 🔒 **الإخفاء ≠ الحذف:** الحقول `customerName`, `providerName`, `authorName` تُستبدل بـ `[Deleted User]` — السجل المالي نفسه يبقى لمتطلبات المحاسبة.

---

### واجهة المستخدم — PrivacyScreen

**الوصول:** الملف الشخصي → 🛡️ "الخصوصية وبياناتي" (`/profile/privacy`)

#### تحميل البيانات
```
[ℹ️ حقوقك معنا]

📥 تحميل بياناتي
   احصل على نسخة كاملة من جميع بياناتك الشخصية
   [طلب تحميل البيانات]         ← يبدأ الطابور الخلفي
   ⏳ جاري إعداد الملف…          ← أثناء المعالجة
   [تحميل] صالح حتى: 22 يناير   ← عند الجهوزية
```

#### حذف الحساب — 3 خطوات إلزامية

```
الخطوة 1: تحذير واضح
  ✅ سيُحذف نهائياً: الملف الشخصي · الرسائل · الإشعارات
  🔒 يُحتفظ به: سجلات الطلبات · المعاملات (7 سنوات)
  [إلغاء]  [متابعة الحذف]

الخطوة 2: سبب المغادرة (radio buttons)
  🚶 لا أستخدم التطبيق بعد الآن
  🔒 مخاوف تتعلق بالخصوصية
  🔄 وجدت بديلاً آخر
  💬 سبب آخر

الخطوة 3: تأكيد بالكتابة
  ⬜ اكتب بالضبط: DELETE MY ACCOUNT
  [حذف حسابي نهائياً]  ← يُفعَّل فقط عند الكتابة الصحيحة
```

---

### اختبارات الوحدة

```bash
cd functions
pnpm test:unit -- --testPathPatterns=gdpr  # أو:
node_modules/.bin/jest --testPathPattern=unit/gdpr --no-coverage --verbose
```

```
PASS  functions/src/__tests__/unit/gdpr.test.ts

  requestDataExport()
    ✓ returns status="queued" and exportId for new export request
    ✓ sets an expiresAt 7 days from now
    ✓ returns existing export if already queued (deduplication)
    ✓ returns downloadUrl immediately if export is already ready
    ✓ throws unauthenticated when auth is missing

  requestAccountDeletion()
    ✓ schedules deletion and returns scheduledFor 30 days from now
    ✓ includes retentionNote in the response
    ✓ throws when active orders exist (blocker)
    ✓ throws when open disputes exist (blocker)
    ✓ throws validation error when confirmation phrase is wrong
    ✓ throws unauthenticated for anonymous caller
    ✓ revokes refresh tokens (signs out all devices) after scheduling

  cancelAccountDeletion()
    ✓ cancels a pending deletion and returns status=cancelled
    ✓ returns no_pending_request when no deletion was requested
    ✓ returns cannot_cancel when deletion already executed
    ✓ throws unauthenticated for anonymous caller

  executeAccountDeletion()
    ✓ calls auth.deleteUser after processing
    ✓ calls storage.deleteFiles for user files
    ✓ marks deletion request as executed in Firestore
    ✓ marks deletion as blocked (not throw) when active orders exist
    ✓ does NOT delete auth account when there are blockers

  Retention policy contract
    ✓ anonymiseFinancialRecords calls batch.update (not delete) on financial docs

Tests: 22 passed  ✅
```

---

### Firestore Collections

```
dataExports/{exportId}
  uid:         string       // مالك التصدير
  status:      'pending' | 'ready' | 'failed' | 'expired'
  downloadUrl: string|null  // Signed URL (7 أيام)
  filePath:    string       // data-exports/{uid}/{exportId}/export.json
  expiresAt:   Timestamp
  createdAt:   Timestamp

deletionRequests/{uid}      // مفتاح الوثيقة = uid (واحد لكل مستخدم)
  status:       'pending' | 'executed' | 'cancelled' | 'blocked' | 'failed'
  scheduledFor: Timestamp   // +30 يوم من تاريخ الطلب
  retentionNote: string     // نص الإفصاح القانوني
  blockers:     string[]    // أسباب الحجب عند الفشل
  executedAt:   Timestamp|null
```

**Security Rules:**
```js
// dataExports — المستخدم يقرأ سجلاته فقط
match /dataExports/{exportId} {
  allow read: if isAuth() && resource.data.uid == request.auth.uid;
  allow write: if false;  // CF admin SDK only
}
// deletionRequests — المستخدم يقرأ سجله فقط
match /deletionRequests/{uid} {
  allow read: if isOwner(uid);
  allow write: if false;
}
```

---

### متغيرات البيئة المطلوبة

```bash
# لإرسال بريد إلكتروني (اختياري)
UNIFONIC_APP_SID=...       # موجود في functions/.env.local
UNIFONIC_SENDER_ID=...
# Storage bucket (من Firebase Console)
GCLOUD_STORAGE_BUCKET=workfix-prod.appspot.com
```

