# WorkFix — API Contracts (Cloud Functions)

> جميع Cloud Functions مكتوبة بـ Firebase Callable Functions.
> كل function تتحقق من Authentication + Role + Rate Limit قبل التنفيذ.
> Last updated: 2026-04-09

---

## استدعاء الـ Functions

```typescript
import { httpsCallable } from 'firebase/functions'
import { firebaseFunctions } from '../lib/firebase'

const fn = httpsCallable(firebaseFunctions, 'functionName')
const result = await fn(payload)
// result.data = ApiSuccess<T> | ApiError
```

---

## Response Wrapper (موحّد لكل الـ Functions)

```typescript
// نجاح
{ ok: true, data: T }

// خطأ
{ ok: false, code: string, message: string, details?: unknown }
```

---

## Auth Functions

### `auth-completeProfile`
إكمال ملف المستخدم بعد التسجيل.

**الأدوار المسموحة:** أي مستخدم مسجّل

**Request:**
```typescript
{
  displayName: string        // مطلوب
  phone?:      string        // اختياري
  preferredLang?: 'ar' | 'en' | 'no' | 'sv'
}
```

**Response:**
```typescript
{ ok: true, data: { uid: string } }
```

---

### `auth-setProviderType`
تحويل المستخدم إلى مزوّد خدمة.

**الأدوار المسموحة:** customer فقط

**Request:**
```typescript
{
  type:          'individual' | 'company'
  businessName?: string   // مطلوب إذا type = 'company'
}
```

**Response:**
```typescript
{ ok: true, data: { providerId: string } }
```

---

### `auth-uploadKyc`
رفع وثائق KYC للمراجعة.

**الأدوار المسموحة:** provider

**Request:**
```typescript
{
  documentUrls: string[]   // روابط Storage (1-5 وثائق)
}
```

**Response:**
```typescript
{ ok: true, data: { kycStatus: 'pending' } }
```

---

## Marketplace Functions

### `marketplace-searchProviders`
البحث عن مزودين بالقرب مع فلاتر.

**الأدوار المسموحة:** الجميع (بدون تسجيل)

**Request:**
```typescript
{
  lat:         number        // خط العرض
  lng:         number        // خط الطول
  radiusKm:    number        // نطاق البحث (1-100)
  categoryId?: string        // فلتر التصنيف
  query?:      string        // بحث نصي
  minRating?:  number        // 1-5
  maxPrice?:   number
  sortBy?:     'distance' | 'rating' | 'price'
  page?:       number        // default: 0
  limit?:      number        // default: 20, max: 50
}
```

**Response:**
```typescript
{
  ok: true,
  data: {
    providers: Array<ProviderProfile & { distanceKm: number }>
    total:     number
    hasMore:   boolean
  }
}
```

---

### `marketplace-getProviderProfile`
جلب ملف مزوّد كامل مع آخر التقييمات.

**Request:**
```typescript
{ providerId: string }
```

**Response:**
```typescript
{
  ok: true,
  data: {
    profile: ProviderProfile
    reviews: Review[]        // آخر 10 تقييمات
  }
}
```

---

## Order Functions

### `orders-createOrder`
إنشاء طلب جديد.

**الأدوار المسموحة:** customer

**Request:**
```typescript
{
  serviceId:       string
  categoryId:      string
  location:        { lat: number; lng: number }
  address:         string      // max 500 حرف
  description:     string      // max 2000 حرف
  attachmentUrls?: string[]    // max 5 صور
  isScheduled?:    boolean
  scheduledAt?:    string      // ISO string — مطلوب إذا isScheduled = true
}
```

**Response:**
```typescript
{ ok: true, data: { orderId: string } }
```

**Side Effects:**
- ينشئ order بحالة `pending`
- يُشغّل trigger لإشعار المزودين القريبين

---

### `orders-submitQuote`
إرسال عرض سعر من المزوّد.

**الأدوار المسموحة:** provider

**Request:**
```typescript
{
  orderId:                  string
  price:                    number   // 1 - 100,000
  estimatedDurationMinutes: number   // 15 - 480
  note?:                    string   // max 500 حرف
}
```

**Response:**
```typescript
{ ok: true, data: { quoteId: string } }
```

---

### `orders-acceptQuote`
قبول عرض سعر وتحويل الطلب إلى مرحلة الدفع.

**الأدوار المسموحة:** customer

**Request:**
```typescript
{
  orderId: string
  quoteId: string
}
```

**Response:**
```typescript
{
  ok: true,
  data: {
    amount:   number
    currency: Currency
  }
}
```

**Side Effects:**
- يُحدّث الطلب: `status → quoted` (أو يبقى حتى يتم الدفع)
- يُشغّل بدء عملية الدفع

---

### `orders-cancelOrder`
إلغاء الطلب.

**الأدوار المسموحة:** customer أو provider

**Request:**
```typescript
{
  orderId: string
  reason:  string   // max 500 حرف
}
```

**Response:**
```typescript
{ ok: true, data: { refunded: boolean } }
```

---

### `orders-markOrderComplete`
تأكيد اكتمال العمل من المزوّد.

**الأدوار المسموحة:** provider (مزوّد الطلب فقط)

**Request:**
```typescript
{ orderId: string }
```

**Response:**
```typescript
{ ok: true }
```

**Side Effects:**
- `status → completed`
- إشعار للعميل لتأكيد الإغلاق

---

### `orders-confirmCompletion`
تأكيد اكتمال الخدمة من العميل وإغلاق الطلب.

**الأدوار المسموحة:** customer

**Request:**
```typescript
{ orderId: string }
```

**Response:**
```typescript
{ ok: true }
```

**Side Effects:**
- `status → closed`
- يُحرّر مبلغ الضمان للمزوّد (capture)
- ينشئ فاتورة تلقائياً

---

## Payment Functions

### `payments-initiatePayment`
بدء عملية دفع عبر Tap Payments.

**الأدوار المسموحة:** customer

**Request:**
```typescript
{
  orderId:    string
  method:     PaymentMethod
  returnUrl?: string         // للدفع بالتحويل (redirect)
}
```

**PaymentMethod:**
```
card | apple_pay | stc_pay | mada | cash | vipps | swish
```

**Response:**
```typescript
{
  ok: true,
  data: {
    tapToken?:   string   // لـ Apple Pay / MADA
    redirectUrl?: string  // للـ WebView redirect
    clientSecret?: string // لـ card inline
  }
}
```

---

### `payments-tapWebhook`
Webhook من Tap Payments (HTTP trigger، ليس callable).

**المُشغّل:** POST من Tap Payments servers
**الأمان:** HMAC signature verification

**Side Effects:**
- `status=CAPTURED` → يُحدّث payment + يُغيّر order إلى `confirmed`
- `status=FAILED` → يُحدّث payment + إشعار للعميل

---

### `payments-requestPayout`
طلب سحب الرصيد من المزوّد.

**الأدوار المسموحة:** provider

**Request:**
```typescript
{
  amount?: number   // اختياري — إذا لم يُحدَّد يسحب الكامل
}
```

**Response:**
```typescript
{ ok: true, data: { payoutId: string; amount: number } }
```

---

## Messaging Functions

### `messaging-getOrCreateConversation`
جلب أو إنشاء محادثة مرتبطة بطلب.

**الأدوار المسموحة:** customer أو provider للطلب

**Request:**
```typescript
{ orderId: string }
```

**Response:**
```typescript
{
  ok: true,
  data: { conversationId: string }
}
```

---

### `messaging-sendMessage`
إرسال رسالة في محادثة.

**الأدوار المسموحة:** customer أو provider للمحادثة

**Request:**
```typescript
{
  conversationId: string
  text?:          string       // نص الرسالة
  mediaUrl?:      string       // رابط الصورة/الوثيقة
  mediaType?:     'image' | 'document'
}
```
> يجب توفير `text` أو `mediaUrl` على الأقل.

**Response:**
```typescript
{ ok: true, data: { messageId: string } }
```

**Side Effects:**
- يُحدّث `lastMessageAt` + `lastMessageText` في المحادثة
- يزيد `unreadCount` للطرف الآخر
- يُرسل Push notification

---

### `messaging-markRead`
تعليم رسائل المحادثة كمقروءة.

**Request:**
```typescript
{ conversationId: string }
```

**Response:**
```typescript
{ ok: true, data: { markedCount: number } }
```

---

### `messaging-setTyping`
تحديث مؤشر الكتابة (TTL-based).

**Request:**
```typescript
{
  conversationId: string
  isTyping:       boolean
}
```

**Response:**
```typescript
{ ok: true }
```

---

## Review Functions

### `reviews-submitReview`
تقديم تقييم بعد إغلاق الطلب.

**الأدوار المسموحة:** customer أو provider

**Request:**
```typescript
{
  orderId:    string
  targetId:   string
  targetType: 'provider' | 'customer'
  rating:     number      // 1-5
  comment?:   string      // max 1000 حرف
  tags?:      string[]    // وسوم اختيارية
}
```

**Response:**
```typescript
{ ok: true, data: { reviewId: string } }
```

**Side Effects:**
- يُحدّث `avgRating` + `totalReviews` في providerProfile

---

### `reviews-openDispute`
فتح نزاع على طلب.

**الأدوار المسموحة:** customer أو provider

**Request:**
```typescript
{
  orderId:       string
  reason:        string      // سبب النزاع
  description:   string      // max 2000 حرف
  evidenceUrls?: string[]    // max 5 ملفات
}
```

**Response:**
```typescript
{ ok: true, data: { disputeId: string } }
```

**Side Effects:**
- `order.status → disputed`
- يُجمّد المبلغ في Escrow

---

## Admin Functions

### `admin-approveKyc`
قبول/رفض/إعادة طلب KYC.

**الأدوار المسموحة:** admin + superadmin

**Request:**
```typescript
{
  providerId: string
  decision:   'approved' | 'rejected' | 'resubmit'
  note?:      string
}
```

**Response:**
```typescript
{ ok: true }
```

---

### `admin-resolveDispute`
حسم نزاع وتحديد من يستلم المبلغ.

**الأدوار المسموحة:** admin + superadmin

**Request:**
```typescript
{
  disputeId:      string
  resolution:     string               // min 10 أحرف
  releaseToParty: 'customer' | 'provider'
}
```

**Response:**
```typescript
{ ok: true }
```

**Side Effects:**
- يُحرّر مبلغ الضمان للطرف المحدد
- `dispute.status → resolved_customer | resolved_provider`
- إشعار للطرفين

---

### `admin-banUser`
حظر أو رفع حظر مستخدم.

**الأدوار المسموحة:** admin + superadmin

**Request:**
```typescript
{
  targetUid: string
  ban:       boolean   // true = حظر، false = رفع الحظر
  reason?:   string   // مطلوب عند الحظر
}
```

**Response:**
```typescript
{ ok: true }
```

---

### `admin-getFinancialReport`
تقرير مالي لفترة زمنية.

**الأدوار المسموحة:** admin + superadmin

**Request:**
```typescript
{
  from: string   // ISO date
  to:   string   // ISO date
}
```

**Response:**
```typescript
{
  ok: true,
  data: {
    totalRevenue:  number
    totalPayouts:  number
    netRevenue:    number
    orderCount:    number
    currency:      Currency
  }
}
```

---

## Subscription Functions

### `subscriptions-createSubscription`
إنشاء اشتراك جديد للمزوّد.

**الأدوار المسموحة:** provider

**Request:**
```typescript
{
  tier:        'pro' | 'business'
  paymentMethod: PaymentMethod
  returnUrl?:  string
}
```

**Response:**
```typescript
{
  ok: true,
  data: {
    subscriptionId: string
    redirectUrl?:   string
  }
}
```

---

### `subscriptions-cancelSubscription`
إلغاء الاشتراك الحالي.

**الأدوار المسموحة:** provider

**Request:**
```typescript
{ subscriptionId: string }
```

**Response:**
```typescript
{ ok: true }
```

---

## Rate Limits

| الفئة | الحد |
|-------|------|
| `api` | 60 طلب / دقيقة لكل مستخدم |
| `auth` | 10 طلبات / دقيقة |
| `payment` | 5 طلبات / دقيقة |
| `message` | 30 رسالة / دقيقة |

---

## Firestore Triggers (ليست Callable)

| الـ Trigger | المُشغّل | الوظيفة |
|-------------|---------|---------|
| `onOrderCreated` | `orders/{id}` create | إشعار المزودين القريبين |
| `onOrderStatusChanged` | `orders/{id}` update | إشعارات تغيير الحالة |
| `onQuoteSubmitted` | `orders/{id}/quotes/{id}` create | إشعار العميل |
| `onPaymentCaptured` | `payments/{id}` update | تحديث حالة الطلب |
| `onDisputeOpened` | `disputes/{id}` create | إشعار الأدمن |
| `onReviewCreated` | `reviews/{id}` create | تحديث avgRating للمزوّد |
