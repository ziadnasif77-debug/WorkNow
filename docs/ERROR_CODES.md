# WorkFix — Error Codes Reference

> مرجع موحّد لكل كودات الأخطاء في التطبيق.
> المصدر: `packages/types/src/index.ts` + `functions/src/_shared/helpers.ts`
> Last updated: 2026-04-09

---

## هيكل الخطأ

```typescript
// ما يصل للـ Client من Cloud Functions
{
  ok:       false,
  code:     string,     // e.g. "AUTH_002"
  message:  string,     // وصف الخطأ
  details?: unknown     // بيانات إضافية (اختياري)
}

// HttpsError من Firebase (داخلياً)
{
  code:    FirebaseErrorCode,  // e.g. "permission-denied"
  message: string,
  details: { appCode: string, httpCode: number }
}
```

---

## Auth Errors — أخطاء المصادقة

| الكود | الاسم | المعنى | Firebase Code | HTTP |
|-------|-------|--------|---------------|------|
| `AUTH_001` | `USER_NOT_FOUND` | المستخدم غير موجود في Firestore | `not-found` | 404 |
| `AUTH_002` | `ROLE_NOT_ALLOWED` | الدور لا يملك صلاحية هذه العملية | `permission-denied` | 403 |
| `AUTH_003` | `ACCOUNT_SUSPENDED` | الحساب محظور | `permission-denied` | 403 |
| `AUTH_004` | `KYC_NOT_APPROVED` | المزوّد لم يُوافَق على KYC بعد | `failed-precondition` | 412 |
| `AUTH_005` | `PROFILE_INCOMPLETE` | الملف الشخصي غير مكتمل | `failed-precondition` | 412 |

**متى يظهر كل خطأ:**
- `AUTH_001` → عند أي عملية تحتاج بيانات المستخدم ولم تُوجد في `/users`
- `AUTH_002` → مثل: عميل يحاول إرسال عرض سعر / مزوّد يحاول فتح طلب
- `AUTH_003` → عند محاولة أي عملية من حساب مُعلَّق (`isActive: false`)
- `AUTH_004` → مزوّد يحاول قبول طلب قبل أن يُراجَع KYC
- `AUTH_005` → مستخدم لم يكمل `completeProfile` بعد التسجيل

---

## Order Errors — أخطاء الطلبات

| الكود | الاسم | المعنى | Firebase Code | HTTP |
|-------|-------|--------|---------------|------|
| `ORD_001` | `ORDER_NOT_FOUND` | الطلب غير موجود | `not-found` | 404 |
| `ORD_002` | `INVALID_ORDER_TRANSITION` | تغيير الحالة غير مسموح | `failed-precondition` | 412 |
| `ORD_003` | `PROVIDER_NOT_AVAILABLE` | المزوّد غير متاح حالياً | `failed-precondition` | 412 |
| `ORD_004` | `QUOTE_EXPIRED` | انتهت صلاحية عرض السعر | `deadline-exceeded` | 410 |
| `ORD_005` | `ORDER_ALREADY_HAS_PROVIDER` | الطلب لديه مزوّد بالفعل | `already-exists` | 409 |

**Order Status Machine — التحولات المسموحة:**

```
pending     → quoted, cancelled
quoted      → confirmed (بعد الدفع), cancelled
confirmed   → in_progress, cancelled, disputed
in_progress → completed, disputed
completed   → closed, disputed
closed      → (نهائي — لا تغيير)
cancelled   → (نهائي — لا تغيير)
disputed    → resolved (بواسطة الأدمن)
```

أي تغيير خارج هذه القائمة يُعطي `ORD_002`.

---

## Payment Errors — أخطاء المدفوعات

| الكود | الاسم | المعنى | Firebase Code | HTTP |
|-------|-------|--------|---------------|------|
| `PAY_001` | `PAYMENT_FAILED` | فشل الدفع في Tap Payments | `internal` | 500 |
| `PAY_002` | `ESCROW_HOLD_FAILED` | فشل تجميد المبلغ في Escrow | `internal` | 500 |
| `PAY_003` | `REFUND_NOT_ELIGIBLE` | الطلب لا يستحق استرداد | `failed-precondition` | 412 |
| `PAY_004` | `INSUFFICIENT_BALANCE` | الرصيد غير كافٍ للسحب | `failed-precondition` | 412 |
| `PAY_005` | `PAYOUT_FAILED` | فشل تحويل المبلغ للمزوّد | `internal` | 500 |

---

## Validation Errors — أخطاء التحقق من المدخلات

| الكود | الاسم | المعنى | Firebase Code | HTTP |
|-------|-------|--------|---------------|------|
| `VAL_001` | `INVALID_INPUT` | مدخلات غير صالحة (Zod validation) | `invalid-argument` | 400 |
| `VAL_002` | `MISSING_REQUIRED_FIELD` | حقل مطلوب مفقود | `invalid-argument` | 400 |
| `VAL_003` | `VALUE_OUT_OF_RANGE` | قيمة خارج النطاق المسموح | `invalid-argument` | 400 |

**مثال على `VAL_001` response:**
```json
{
  "ok": false,
  "code": "VAL_001",
  "message": "Invalid input",
  "details": {
    "price": "Number must be greater than 0",
    "orderId": "Required"
  }
}
```

---

## General Errors — أخطاء عامة

| الكود | الاسم | المعنى | Firebase Code | HTTP |
|-------|-------|--------|---------------|------|
| `GEN_001` | `INTERNAL_SERVER_ERROR` | خطأ داخلي غير متوقع | `internal` | 500 |
| `GEN_002` | `RATE_LIMIT_EXCEEDED` | تجاوز حد الطلبات | `resource-exhausted` | 429 |
| `GEN_003` | `FEATURE_DISABLED` | الميزة معطّلة مؤقتاً | `unavailable` | 503 |
| `GEN_004` | `NOT_FOUND` | المورد غير موجود | `not-found` | 404 |

---

## معالجة الأخطاء في Mobile App

```typescript
// في أي Store
try {
  const fn = httpsCallable(functions, 'orders-createOrder')
  const result = await fn(payload)
  const data = result.data as ApiResponse<{ orderId: string }>

  if (!data.ok) {
    // خطأ من التطبيق
    handleAppError(data.code, data.message)
    return
  }

  // نجاح
  return data.data.orderId

} catch (err: unknown) {
  // خطأ شبكة أو Firebase
  const mapped = mapFirebaseError(err)
  set({ actionError: mapped })
}
```

---

## mapFirebaseError — تحويل الأخطاء للعربي

الملف: `apps/mobile/src/lib/firebaseErrorMap.ts`

| Firebase Code | الرسالة بالعربي |
|---------------|----------------|
| `permission-denied` | ليس لديك صلاحية |
| `not-found` | العنصر غير موجود |
| `already-exists` | موجود مسبقاً |
| `invalid-argument` | بيانات غير صحيحة |
| `resource-exhausted` | تم تجاوز الحد المسموح |
| `unauthenticated` | يجب تسجيل الدخول |
| `unavailable` | الخدمة غير متاحة مؤقتاً |
| `deadline-exceeded` | انتهت مهلة الطلب |
| `internal` | خطأ داخلي، حاول مجدداً |
| `cancelled` | تم إلغاء العملية |

---

## Rate Limits — حدود الاستخدام

الملف: `functions/src/_shared/ratelimit.ts`

| النوع | المفتاح | الحد | النافذة |
|-------|---------|------|---------|
| `api` | `uid:api` | 60 طلب | دقيقة |
| `auth` | `uid:auth` | 10 طلبات | دقيقة |
| `payment` | `uid:payment` | 5 طلبات | دقيقة |
| `message` | `uid:message` | 30 رسالة | دقيقة |

عند التجاوز: `GEN_002 / RATE_LIMIT_EXCEEDED / HTTP 429`

---

## استخدام `appError()` في Cloud Functions

```typescript
import { appError } from '../_shared/helpers'

// الصيغة
appError(
  code: string,           // e.g. 'AUTH_002'
  message: string,        // رسالة للـ log
  firebaseCode: FunctionsErrorCode,  // e.g. 'permission-denied'
  httpCode?: number       // اختياري
)

// مثال
if (order.customerId !== uid) {
  appError('AUTH_002', 'Not your order', 'permission-denied')
}
```
