# WorkFix — Admin Dashboard (Retool)

## إعداد Retool

### الاتصال بالـ Backend
اتصال نوع **REST API** يستدعي Cloud Functions مباشرة.

**Base URL:** `https://me-central1-{PROJECT_ID}.cloudfunctions.net`

**Headers:**
```
Authorization: Bearer {{firebase_admin_token}}
Content-Type: application/json
```

---

## الصفحات والـ Queries

### 1. لوحة الإحصاءات الرئيسية

**Query: getFinancialReport**
```json
POST /admin-getFinancialReport
{
  "data": {
    "from": "{{startDate.value}}",
    "to": "{{endDate.value}}"
  }
}
```

**المكوّنات:**
- `statCard` × 4: إجمالي المعاملات، إجمالي الإيرادات، إجمالي العمولة، المستخدمون الجدد
- `lineChart`: إيرادات يومية/أسبوعية
- `barChart`: أكثر الفئات طلباً

---

### 2. مراجعة KYC

**Query: getPendingKyc**
```javascript
// Firestore query via REST
GET /v1/projects/{PROJECT_ID}/databases/(default)/documents/providerProfiles
?where=kycStatus:EQUAL:pending
```

**المكوّنات:**
- `table`: قائمة المزوّدين بانتظار المراجعة
  - أعمدة: الاسم، النوع، تاريخ التسجيل، المستندات
- `buttonGroup`: موافقة / رفض / طلب إعادة رفع
- `image`: عرض المستندات المرفوعة

**Query: approveKyc**
```json
POST /admin-approveKyc
{
  "data": {
    "providerId": "{{table.selectedRow.data.id}}",
    "decision": "{{decision.value}}",
    "note": "{{noteInput.value}}"
  }
}
```

---

### 3. إدارة النزاعات

**Query: getOpenDisputes**
```javascript
GET /v1/projects/{PROJECT_ID}/databases/(default)/documents/disputes
?where=status:IN:["open","under_review"]
```

**المكوّنات:**
- `table`: النزاعات المفتوحة مع تفاصيل الطلب
- `textArea`: نص القرار
- `select`: تحرير المبلغ لـ (عميل / مزوّد)
- `button`: إصدار الحكم

**Query: resolveDispute**
```json
POST /admin-resolveDispute
{
  "data": {
    "disputeId": "{{table.selectedRow.data.id}}",
    "resolution": "{{resolutionText.value}}",
    "releaseToParty": "{{releaseSelect.value}}"
  }
}
```

---

### 4. إدارة المستخدمين

**Query: searchUsers**
```javascript
GET /v1/projects/{PROJECT_ID}/databases/(default)/documents/users
?where=displayName:CONTAINS:{{searchInput.value}}
```

**المكوّنات:**
- `searchInput` + `table`: بحث وعرض المستخدمين
- `badge`: الدور (عميل/مزوّد/مشرف)
- `button`: حظر / رفع الحظر

---

### 5. التقارير المالية

**المكوّنات:**
- `datePicker` × 2: من/إلى
- `stat` × 3: إجمالي المبالغ، العمولة، المدفوع للمزوّدين
- `table`: قائمة المدفوعات مع تصدير CSV
- `pieChart`: توزيع طرق الدفع

---

## Feature Flags (Firebase Remote Config)

| Flag | النوع | الوصف |
|---|---|---|
| `subscriptions_enabled` | boolean | تفعيل الاشتراكات |
| `boost_enabled` | boolean | تفعيل الظهور المميز |
| `disputes_enabled` | boolean | تفعيل النزاعات |
| `cash_payment_enabled` | boolean | تفعيل الدفع كاش |
| `norway_market_enabled` | boolean | السوق النرويجي |
| `sweden_market_enabled` | boolean | السوق السويدي |
| `commission_rate` | number | نسبة العمولة (0.12 = 12%) |

---

## الوصول والأمان

- فقط المستخدمون بـ `role: admin` أو `role: superadmin` في Custom Claims
- كل Cloud Function تتحقق من الدور قبل التنفيذ
- جلسات Retool تنتهي بعد 8 ساعات
