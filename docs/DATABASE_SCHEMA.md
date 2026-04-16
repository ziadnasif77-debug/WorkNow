# WorkFix — Database Schema (Firestore)

> Single source of truth for all Firestore collections, fields, relationships, and indexes.
> Last updated: 2026-04-09

---

## Collections Overview

```
firestore/
├── users/                          {userId}
│   └── notifications/              {notifId}
├── providerProfiles/               {userId}
├── categories/                     {categoryId}
├── services/                       {serviceId}
├── orders/                         {orderId}
│   └── quotes/                     {quoteId}
├── payments/                       {paymentId}
├── conversations/                  {convId}
│   └── messages/                   {msgId}
├── reviews/                        {reviewId}
├── disputes/                       {disputeId}
├── subscriptions/                  {subId}
├── invoices/                       {invoiceId}
├── invoiceCounters/                {prefix}
├── dataExports/                    {exportId}
├── deletionRequests/               {reqId}
├── fraudAlerts/                    {alertId}
├── _taskQueue/                     {taskId}
└── _rateLimits/                    {limitId}
```

---

## /users/{userId}

المستخدمون (عملاء + مزودون + أدمن)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | = Firebase Auth UID |
| `email` | string? | البريد الإلكتروني |
| `phone` | string? | رقم الهاتف بالصيغة الدولية |
| `displayName` | string | الاسم الظاهر |
| `avatarUrl` | string? | رابط الصورة الشخصية |
| `role` | `customer \| provider \| admin \| superadmin` | دور المستخدم |
| `isVerified` | boolean | حساب موثّق |
| `isActive` | boolean | false = محظور |
| `isBanned` | boolean? | تم حظره من الأدمن |
| `banReason` | string? | سبب الحظر |
| `fcmTokens` | string[]? | توكنات الإشعارات (متعددة أجهزة) |
| `preferredLang` | `ar \| en \| no \| sv` | اللغة المفضلة |
| `notificationPrefs` | object? | تفضيلات الإشعارات |
| `notificationPrefs.newOrder` | boolean | إشعار طلب جديد (للمزوّد) |
| `notificationPrefs.newMessage` | boolean | إشعار رسالة جديدة |
| `notificationPrefs.orderUpdates` | boolean | تحديثات الطلب |
| `notificationPrefs.promotions` | boolean | عروض تسويقية |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

**Indexes:** لا حاجة لـ composite index — queries على UID فقط.

---

## /users/{userId}/notifications/{notifId}

إشعارات المستخدم (subcollection)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `userId` | string | مرجع للمستخدم |
| `type` | NotificationType | نوع الإشعار |
| `title` | `{ar, en}` | عنوان الإشعار |
| `body` | `{ar, en}` | نص الإشعار |
| `isRead` | boolean | |
| `refId` | string? | معرّف الكيان المرتبط (orderId / disputeId) |
| `refType` | `order \| dispute \| message \| payment`? | نوع المرجع |
| `createdAt` | Timestamp | |

**Indexes:**
- `isRead ASC + createdAt DESC` (COLLECTION_GROUP)

---

## /providerProfiles/{userId}

ملف مزود الخدمة (id = userId)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | = userId |
| `type` | `individual \| company` | نوع المزوّد |
| `businessName` | string? | اسم الشركة (إذا type=company) |
| `bio` | string? | نبذة عن المزوّد |
| `location` | GeoPoint | الموقع الجغرافي |
| `geohash` | string | مشفّر من location للبحث الجغرافي |
| `city` | string | المدينة |
| `country` | string | كود الدولة (SA, AE, NO...) |
| `serviceIds` | string[] | معرّفات الخدمات |
| `categoryIds` | string[] | معرّفات التصنيفات |
| `avgRating` | number | متوسط التقييم (1–5) |
| `totalReviews` | number | عدد التقييمات |
| `totalCompletedOrders` | number | عدد الطلبات المكتملة |
| `kycStatus` | `pending \| approved \| rejected \| resubmit` | حالة التحقق |
| `kycDocumentUrls` | string[] | روابط وثائق KYC |
| `subscriptionTier` | `free \| pro \| business` | مستوى الاشتراك |
| `boostExpiresAt` | Timestamp? | انتهاء تعزيز الظهور |
| `isActive` | boolean | ظاهر في البحث |
| `workingHours` | WorkingHours? | ساعات العمل |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

**WorkingHours:**
```json
{
  "sun": { "open": "09:00", "close": "18:00", "isOff": false },
  "fri": { "open": "14:00", "close": "21:00", "isOff": false },
  "sat": { "open": "", "close": "", "isOff": true }
}
```

**Indexes:**
- `isActive ASC + geohash ASC`
- `isActive ASC + categoryIds CONTAINS + geohash ASC`
- `categoryIds CONTAINS + isActive ASC + kycStatus ASC`
- `kycStatus ASC + createdAt DESC`

---

## /categories/{categoryId}

تصنيفات الخدمات

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `name` | `{ar, en}` | الاسم |
| `description` | `{ar, en}`? | الوصف |
| `iconUrl` | string | رابط الأيقونة |
| `icon` | string? | إيموجي للعرض السريع |
| `serviceCount` | number? | عدد الخدمات النشطة (denormalized) |
| `parentId` | string? | null = تصنيف رئيسي |
| `sortOrder` | number | ترتيب العرض |
| `isActive` | boolean | |
| `createdAt` | Timestamp | |

**قراءة عامة:** `allow read: if true`

---

## /services/{serviceId}

خدمات المزودين

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `providerId` | string | مرجع للمزوّد |
| `categoryId` | string | مرجع للتصنيف |
| `title` | `{ar, en}` | عنوان الخدمة |
| `description` | `{ar, en}` | وصف الخدمة |
| `basePrice` | number | السعر الأساسي |
| `priceType` | `fixed \| hourly \| quote_required` | نوع التسعير |
| `currency` | Currency | العملة |
| `imageUrls` | string[] | صور الخدمة |
| `tags` | string[] | وسوم البحث |
| `isActive` | boolean | |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

---

## /orders/{orderId}

الطلبات — العمود الفقري للتطبيق

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `customerId` | string | مرجع للعميل |
| `customerName` | string | مشارك (denormalized) |
| `customerAvatarUrl` | string? | |
| `providerId` | string? | null حتى قبول عرض |
| `providerName` | string? | مشارك |
| `providerAvatarUrl` | string? | |
| `serviceId` | string | مرجع للخدمة |
| `serviceName` | `{ar, en}` | مشارك |
| `categoryId` | string | |
| `status` | OrderStatus | حالة الطلب |
| `quotedPrice` | number? | السعر المقترح من المزوّد |
| `finalPrice` | number? | السعر النهائي بعد القبول |
| `commissionRate` | number | نسبة العمولة (0.12 = 12%) |
| `commissionAmount` | number? | مبلغ العمولة |
| `netAmount` | number? | finalPrice - commissionAmount |
| `paymentStatus` | PaymentStatus | حالة الدفع |
| `paymentMethod` | PaymentMethod? | طريقة الدفع |
| `currency` | Currency | |
| `escrowPaymentId` | string? | معرّف الدفع في Tap Payments |
| `location` | GeoPoint | موقع تنفيذ الخدمة |
| `address` | string | العنوان النصي |
| `description` | string | وصف المشكلة |
| `attachmentUrls` | string[] | صور مرفقة |
| `isScheduled` | boolean | هل مجدول؟ |
| `scheduledAt` | Timestamp? | موعد التنفيذ |
| `acceptedAt` | Timestamp? | وقت قبول العرض |
| `startedAt` | Timestamp? | وقت بدء العمل |
| `completedAt` | Timestamp? | وقت إكمال المزوّد |
| `closedAt` | Timestamp? | وقت تأكيد العميل |
| `cancelledAt` | Timestamp? | |
| `cancelReason` | string? | |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

**Order Status Machine:**
```
pending → quoted → confirmed → in_progress → completed → closed
   ↓          ↓         ↓            ↓
cancelled  cancelled  cancelled    disputed
```

**Indexes:**
- `customerId ASC + createdAt DESC`
- `customerId ASC + status ASC + createdAt DESC`
- `providerId ASC + createdAt DESC`
- `providerId ASC + status ASC + createdAt DESC`
- `status ASC + scheduledAt ASC`

---

## /orders/{orderId}/quotes/{quoteId}

عروض الأسعار (subcollection)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `orderId` | string | |
| `providerId` | string | |
| `providerName` | string | مشارك |
| `providerAvatarUrl` | string? | |
| `providerRating` | number | |
| `price` | number | السعر المقترح |
| `currency` | Currency | |
| `estimatedDurationMinutes` | number | الوقت التقديري |
| `note` | string? | ملاحظة المزوّد |
| `status` | `pending \| accepted \| rejected \| expired` | |
| `expiresAt` | Timestamp | انتهاء صلاحية العرض |
| `createdAt` | Timestamp | |

---

## /payments/{paymentId}

المدفوعات (يكتبها Cloud Functions فقط)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `orderId` | string | |
| `customerId` | string | |
| `providerId` | string | |
| `tapId` | string | معرّف الدفع في Tap Payments |
| `amount` | number | المبلغ الكامل |
| `commission` | number | العمولة |
| `netAmount` | number | صافي المبلغ للمزوّد |
| `status` | `initiated \| held \| captured \| refunded \| failed` | |
| `method` | PaymentMethod | |
| `currency` | Currency | |
| `metadata` | Record<string,string>? | بيانات إضافية |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |
| `capturedAt` | Timestamp? | |
| `refundedAt` | Timestamp? | |

**Indexes:**
- `providerId ASC + status ASC`
- `status ASC + createdAt ASC`

---

## /conversations/{convId}

المحادثات (مرتبطة بـ order)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `orderId` | string | |
| `customerId` | string | |
| `providerId` | string | |
| `lastMessageAt` | Timestamp | آخر رسالة |
| `lastMessageText` | string | معاينة آخر رسالة |
| `lastMessageSenderId` | string | |
| `unreadCount` | `Record<userId, number>` | عداد غير المقروء لكل مستخدم |
| `typingExpiresAt` | `Record<userId, number>` | unix ms انتهاء مؤشر الكتابة |
| `createdAt` | Timestamp | |

**Indexes:**
- `customerId ASC + lastMessageAt DESC`
- `providerId ASC + lastMessageAt DESC`

---

## /conversations/{convId}/messages/{msgId}

الرسائل (subcollection)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `conversationId` | string | |
| `senderId` | string | |
| `senderName` | string | مشارك |
| `senderAvatarUrl` | string? | |
| `text` | string? | نص الرسالة |
| `mediaUrl` | string? | رابط الوسائط |
| `mediaType` | `image \| document`? | |
| `isRead` | boolean | |
| `readAt` | Timestamp? | |
| `sentAt` | Timestamp | |

**Indexes:**
- `conversationId ASC + sentAt ASC`
- `senderId ASC + isRead ASC` (COLLECTION_GROUP)

---

## /reviews/{reviewId}

التقييمات

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `orderId` | string | |
| `reviewerId` | string | |
| `reviewerName` | string | مشارك |
| `reviewerAvatarUrl` | string? | |
| `targetId` | string | المُقيَّم (providerId أو customerId) |
| `targetType` | `provider \| customer` | |
| `rating` | number | 1–5 |
| `comment` | string? | |
| `createdAt` | Timestamp | |

**Indexes:**
- `targetId ASC + createdAt DESC`
- `orderId ASC + reviewerId ASC`

---

## /disputes/{disputeId}

النزاعات

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `orderId` | string | |
| `customerId` | string | |
| `providerId` | string | |
| `initiatorId` | string | من فتح النزاع |
| `initiatorRole` | `customer \| provider` | |
| `respondentId` | string | |
| `reason` | string | سبب النزاع |
| `description` | string | وصف تفصيلي |
| `evidenceUrls` | string[] | صور/وثائق كأدلة |
| `status` | DisputeStatus | |
| `resolution` | string? | قرار الأدمن |
| `adminId` | string? | الأدمن الذي حسم النزاع |
| `releaseToParty` | `customer \| provider`? | من يستلم المبلغ |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |
| `resolvedAt` | Timestamp? | |

**DisputeStatus:**
```
open → under_review → resolved_customer | resolved_provider | closed
```

**Indexes:**
- `orderId ASC + status ASC`
- `customerId ASC + status ASC`
- `status ASC + createdAt DESC`

---

## /subscriptions/{subId}

اشتراكات المزودين

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `providerId` | string | |
| `tier` | `free \| pro \| business` | مستوى الاشتراك |
| `status` | `active \| cancelled \| past_due \| trialing` | |
| `tapSubscriptionId` | string | معرّف الاشتراك في Tap |
| `startAt` | Timestamp | |
| `endAt` | Timestamp | |
| `autoRenew` | boolean | |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

**Indexes:**
- `providerId ASC + status ASC`
- `tapSubscriptionId ASC + providerId ASC`

---

## /invoices/{invoiceId}

الفواتير (تُنشأ تلقائياً بعد إغلاق الطلب)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | string | |
| `invoiceNumber` | string | e.g. "SA-2025-00042" |
| `orderId` | string | |
| `customerId` | string | |
| `providerId` | string | |
| `invoiceUrl` | string | رابط موقّع (30 يوم) |
| `filePath` | string | مسار Storage |
| `fileSize` | number | bytes |
| `expiresAt` | string | ISO date |
| `currency` | Currency | |
| `totalAmount` | number | |
| `vatAmount` | number | ضريبة القيمة المضافة |
| `vatRate` | number | نسبة الضريبة |
| `commissionAmount` | number | |
| `countryCode` | string | |
| `status` | `generated \| expired` | |
| `createdAt` | Timestamp | |

**Indexes:**
- `orderId ASC + createdAt DESC`

---

## Internal Collections

### /_taskQueue/{taskId}
طابور المهام الخلفية (Background Jobs)

| الحقل | النوع |
|-------|-------|
| `type` | string (نوع المهمة) |
| `payload` | object |
| `status` | `pending \| processing \| done \| failed` |
| `runAfter` | Timestamp |
| `attempts` | number |
| `lastError` | string? |
| `createdAt` | Timestamp |

**Index:** `status ASC + runAfter ASC`

### /_rateLimits/{key}
حماية من الإرسال المتكرر

| الحقل | النوع |
|-------|-------|
| `count` | number |
| `lastHit` | Timestamp |

---

## العلاقات بين Collections

```
users ──────────────────────── providerProfiles (1:1 بنفس الـ id)
users ──────────────────────── orders.customerId (1:N)
providerProfiles ───────────── orders.providerId (1:N)
orders ─────────────────────── quotes (1:N subcollection)
orders ─────────────────────── payments (1:1)
orders ─────────────────────── conversations (1:1)
orders ─────────────────────── reviews (1:2 max)
orders ─────────────────────── disputes (1:1)
orders ─────────────────────── invoices (1:1)
conversations ──────────────── messages (1:N subcollection)
providerProfiles ───────────── subscriptions (1:1 active)
users ──────────────────────── notifications (1:N subcollection)
```
