// ─────────────────────────────────────────────────────────────────────────────
// i18n setup — 4 languages: Arabic (AR), English (EN), Norwegian (NO), Swedish (SV)
//
// Direction logic:
//   ar  → RTL  (right-to-left)
//   en  → LTR
//   no  → LTR  (Norwegian Bokmål)
//   sv  → LTR  (Swedish)
//
// Changing to/from Arabic triggers an app reload to apply RTL layout.
// Switching between en/no/sv is instant — no reload needed (all LTR).
// ─────────────────────────────────────────────────────────────────────────────

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { I18nManager } from 'react-native'
import * as Updates from 'expo-updates'
import { MMKV } from 'react-native-mmkv'
import type { SupportedLocale } from '@workfix/types'

const storage = new MMKV({ id: 'i18n' })

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATION KEYS TYPE (prevents typos at compile time)
// ─────────────────────────────────────────────────────────────────────────────

interface Translations {
  common: {
    loading: string; error: string; retry: string; cancel: string
    confirm: string; save: string; close: string; search: string
    back: string; next: string; done: string; yes: string; no: string
    sar: string; km: string; minutes: string
  }
  auth: {
    welcome: string; tagline: string; loginTitle: string; registerTitle: string
    email: string; password: string; phone: string; otp: string
    otpSent: string; name: string; iam: string; customer: string
    provider: string; individual: string; company: string; businessName: string
    kycTitle: string; kycDesc: string; kycPending: string
    forgotPassword: string; orContinueWith: string; google: string
    alreadyHaveAccount: string; noAccount: string
  }
  home: {
    greeting: string; searchPlaceholder: string; categories: string
    nearbyProviders: string; noProvidersNearby: string; seeAll: string
  }
  orders: {
    title: string; newOrder: string; descriptionLabel: string
    descriptionHint: string; attachPhotos: string; scheduleLabel: string
    scheduleNow: string; scheduleLater: string; status: string
    quoteReceived: string; acceptQuote: string; rejectQuote: string
    confirmDone: string; raiseDispute: string; noOrders: string
    downloadInvoice: string; downloadInvoiceHint: string
    invoiceReady: string; invoiceReadyDesc: string; invoiceError: string
  }
  payment: {
    title: string; total: string; method: string; card: string
    applePay: string; stcPay: string; cash: string; vipps: string; swish: string
    escrowNote: string; payNow: string; success: string; failed: string
  }
  chat: {
    placeholder: string; send: string; typing: string
    today: string; yesterday: string
  }
  provider: {
    rating: string; reviews: string; services: string; completedOrders: string
    sendQuote: string; quotePrice: string; quoteDuration: string
    quoteNote: string; wallet: string; balance: string
    pending: string; requestPayout: string
  }
  support: {
    offlineBanner: string; onlineBanner: string; loadingLocal: string
    loadError: string; openBrowser: string; lastUpdated: string
  }
  privacy: {
    screenTitle: string; introTitle: string; introText: string
    exportTitle: string; exportDesc: string; exportHint: string
    exportIncludesLabel: string; exportIncludes: string
    requestExport: string; exportQueued: string; exportQueuedDesc: string
    exportQueuedBadge: string; exportReady: string; exportReadyDesc: string
    exportExpiresHint: string; download: string
    deleteTitle: string; deleteDesc: string; deleteHint: string
    requestDeletion: string; cancelDeletion: string; cancelDeletionHint: string
    deletionPending: string; deletionCancelled: string; deletionCancelledDesc: string
    deletionAlreadyRequested: string; deletionScheduled: string
    retentionNote: string
    deleteModalTitle: string; deleteModalWarning: string
    deleteWillDelete: string; deleteWillDeleteItems: string
    deleteWillKeep: string; deleteWillKeepItems: string
    continueToDelete: string; reasonTitle: string
    reason_no_longer_using: string; reason_privacy: string
    reason_alternative: string; reason_other: string
    confirmDeleteTitle: string; confirmDeleteInstr: string
    confirmDeleteBtn: string; typeConfirmation: string
    gracePeriodNote: string; policiesTitle: string
    contactDPO: string; legalNote: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARABIC (AR) — RTL
// ─────────────────────────────────────────────────────────────────────────────

const ar: Translations = {
  common: {
    loading: 'جارٍ التحميل...', error: 'حدث خطأ', retry: 'حاول مجدداً',
    cancel: 'إلغاء', confirm: 'تأكيد', save: 'حفظ', close: 'إغلاق',
    search: 'بحث', back: 'رجوع', next: 'التالي', done: 'تم',
    yes: 'نعم', no: 'لا', sar: 'ر.س', km: 'كم', minutes: 'دقيقة',
  },
  auth: {
    welcome: 'أهلاً بك في WorkFix', tagline: 'احجز خدمتك في دقائق',
    loginTitle: 'تسجيل الدخول', registerTitle: 'إنشاء حساب جديد',
    email: 'البريد الإلكتروني', password: 'كلمة المرور',
    phone: 'رقم الجوال', otp: 'رمز التحقق',
    otpSent: 'تم إرسال رمز التحقق إلى {{phone}}',
    name: 'الاسم الكامل', iam: 'أنا...',
    customer: 'عميل أبحث عن خدمة', provider: 'مزوّد خدمة',
    individual: 'فرد / مستقل', company: 'شركة',
    businessName: 'اسم الشركة', kycTitle: 'توثيق الهوية',
    kycDesc: 'يرجى رفع صورة الهوية الوطنية أو السجل التجاري',
    kycPending: 'مستنداتك قيد المراجعة. سيتم إخطارك عند الموافقة.',
    forgotPassword: 'نسيت كلمة المرور؟', orContinueWith: 'أو تابع بـ',
    google: 'Google', alreadyHaveAccount: 'لديك حساب؟ تسجيل الدخول',
    noAccount: 'ليس لديك حساب؟ إنشاء حساب',
  },
  home: {
    greeting: 'أهلاً، {{name}} 👋', searchPlaceholder: 'ابحث عن خدمة...',
    categories: 'الفئات', nearbyProviders: 'مزوّدون قريبون منك',
    noProvidersNearby: 'لا يوجد مزوّدون في منطقتك حالياً', seeAll: 'عرض الكل',
  },
  orders: {
    title: 'طلباتي', newOrder: 'طلب جديد',
    descriptionLabel: 'وصف المشكلة',
    descriptionHint: 'صف ما تحتاجه بالتفصيل...',
    attachPhotos: 'إرفاق صور', scheduleLabel: 'جدولة الموعد',
    scheduleNow: 'الآن', scheduleLater: 'تحديد موعد',
    status: 'الحالة', quoteReceived: 'تلقّيت عرض سعر',
    acceptQuote: 'قبول العرض', rejectQuote: 'رفض',
    confirmDone: 'تأكيد الإنجاز', raiseDispute: 'رفع نزاع',
    noOrders: 'لا توجد طلبات حتى الآن',
    downloadInvoice: 'تحميل الفاتورة',
    downloadInvoiceHint: 'يفتح الفاتورة بصيغة PDF في المتصفح',
    invoiceReady: 'الفاتورة جاهزة',
    invoiceReadyDesc: 'رقم الفاتورة: {{number}}',
    invoiceError: 'تعذّر توليد الفاتورة',
  },
  payment: {
    title: 'الدفع', total: 'الإجمالي', method: 'طريقة الدفع',
    card: 'بطاقة ائتمان / مدى', applePay: 'Apple Pay',
    stcPay: 'STC Pay', cash: 'كاش عند الاستلام',
    vipps: 'Vipps', swish: 'Swish',
    escrowNote: 'سيُحتجز المبلغ حتى إتمام الخدمة',
    payNow: 'ادفع الآن', success: 'تم الدفع بنجاح ✓',
    failed: 'فشل الدفع. يرجى المحاولة مجدداً.',
  },
  chat: {
    placeholder: 'اكتب رسالة...', send: 'إرسال',
    typing: 'يكتب...', today: 'اليوم', yesterday: 'أمس',
  },
  provider: {
    rating: 'التقييم', reviews: 'تقييمات', services: 'الخدمات',
    completedOrders: 'طلبات منجزة', sendQuote: 'إرسال عرض سعر',
    quotePrice: 'السعر', quoteDuration: 'المدة التقديرية (بالدقائق)',
    quoteNote: 'ملاحظات (اختياري)', wallet: 'المحفظة',
    balance: 'الرصيد المتاح', pending: 'قيد التحرير',
    requestPayout: 'طلب سحب',
  },
  support: {
    offlineBanner: 'عرض نسخة محفوظة — بلا اتصال',
    onlineBanner: 'جارٍ التحميل من workfix.app…', loadingLocal: 'جارٍ تحميل المحتوى المحلي…',
    loadError: 'تعذّر تحميل الصفحة', openBrowser: 'فتح في المتصفح', lastUpdated: 'آخر تحديث للمحتوى المحفوظ',
  },
  privacy: {
    screenTitle: 'الخصوصية وبياناتي', introTitle: 'حقوقك معنا',
    introText: 'وفق GDPR ونظام PDPL، يحق لك تحميل بياناتك أو طلب حذف حسابك.',
    exportTitle: 'تحميل بياناتي', exportDesc: 'احصل على نسخة كاملة من جميع بياناتك.',
    exportHint: 'سيُرسل رابط التحميل إلى بريدك خلال دقائق',
    exportIncludesLabel: 'يشمل الملف:', exportIncludes: 'الملف الشخصي · الطلبات · الرسائل · التقييمات · الإشعارات',
    requestExport: 'طلب تحميل البيانات', exportQueued: 'طلبك قيد المعالجة',
    exportQueuedDesc: 'ستتلقى إشعاراً بالبريد عند جاهزية الملف.', exportQueuedBadge: 'جاري إعداد الملف…',
    exportReady: 'الملف جاهز', exportReadyDesc: 'صالح حتى: {{expiry}}', exportExpiresHint: 'الرابط صالح حتى: {{expiry}}',
    download: 'تحميل',
    deleteTitle: 'حذف الحساب', deleteDesc: 'حذف دائم لجميع بياناتك. لا يمكن التراجع بعد فترة السماح.',
    deleteHint: 'سيُعلّق حسابك فوراً ويُحذف نهائياً بعد 30 يوماً',
    requestDeletion: 'طلب حذف الحساب', cancelDeletion: 'إلغاء طلب الحذف',
    cancelDeletionHint: 'ألغِ طلب الحذف قبل موعده', deletionPending: 'حذف الحساب مجدول بتاريخ: {{date}}',
    deletionCancelled: 'تم إلغاء طلب الحذف', deletionCancelledDesc: 'حسابك نشط مجدداً.',
    deletionAlreadyRequested: 'طلب الحذف موجود مسبقاً', deletionScheduled: 'تم جدولة حذف الحساب',
    retentionNote: 'السجلات المالية تُجعل مجهولة الهوية ولا تُحذف حسب المتطلبات القانونية.',
    deleteModalTitle: 'تحذير: هذا الإجراء لا يمكن التراجع عنه',
    deleteModalWarning: 'سيتم تعليق حسابك فوراً وحذفه نهائياً بعد 30 يوماً من التأكيد.',
    deleteWillDelete: 'سيُحذف نهائياً:', deleteWillDeleteItems: 'الملف الشخصي · الرسائل · الإشعارات · بيانات الدخول',
    deleteWillKeep: 'يُحتفظ به (مجهول الهوية):', deleteWillKeepItems: 'سجلات الطلبات · المعاملات المالية (7 سنوات)',
    continueToDelete: 'متابعة الحذف', reasonTitle: 'لماذا تريد المغادرة؟',
    reason_no_longer_using: 'لا أستخدم التطبيق بعد الآن', reason_privacy: 'مخاوف تتعلق بالخصوصية',
    reason_alternative: 'وجدت بديلاً آخر', reason_other: 'سبب آخر',
    confirmDeleteTitle: 'تأكيد الحذف النهائي', confirmDeleteInstr: 'لتأكيد الحذف، اكتب بالضبط:',
    confirmDeleteBtn: 'حذف حسابي نهائياً', typeConfirmation: 'اكتب جملة التأكيد',
    gracePeriodNote: 'يمكنك إلغاء هذا الطلب خلال 30 يوماً بمجرد تسجيل الدخول.',
    policiesTitle: 'السياسات والقانونية', contactDPO: 'التواصل مع مسؤول حماية البيانات',
    legalNote: 'WorkFix ملتزم بـ GDPR ونظام PDPL السعودي.',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH (EN) — LTR
// ─────────────────────────────────────────────────────────────────────────────

const en: Translations = {
  common: {
    loading: 'Loading...', error: 'Something went wrong', retry: 'Retry',
    cancel: 'Cancel', confirm: 'Confirm', save: 'Save', close: 'Close',
    search: 'Search', back: 'Back', next: 'Next', done: 'Done',
    yes: 'Yes', no: 'No', sar: 'SAR', km: 'km', minutes: 'min',
  },
  auth: {
    welcome: 'Welcome to WorkFix', tagline: 'Book your service in minutes',
    loginTitle: 'Sign In', registerTitle: 'Create Account',
    email: 'Email', password: 'Password', phone: 'Phone Number',
    otp: 'Verification Code', otpSent: 'Code sent to {{phone}}',
    name: 'Full Name', iam: 'I am a...',
    customer: 'Customer looking for a service', provider: 'Service Provider',
    individual: 'Individual / Freelancer', company: 'Company',
    businessName: 'Business Name', kycTitle: 'Identity Verification',
    kycDesc: 'Please upload your national ID or commercial registration',
    kycPending: 'Your documents are under review. You will be notified upon approval.',
    forgotPassword: 'Forgot Password?', orContinueWith: 'Or continue with',
    google: 'Google', alreadyHaveAccount: 'Already have an account? Sign In',
    noAccount: "Don't have an account? Sign Up",
  },
  home: {
    greeting: 'Hello, {{name}} 👋', searchPlaceholder: 'Search for a service...',
    categories: 'Categories', nearbyProviders: 'Nearby Providers',
    noProvidersNearby: 'No providers in your area yet', seeAll: 'See All',
  },
  orders: {
    title: 'My Orders', newOrder: 'New Order',
    descriptionLabel: 'Describe the issue',
    descriptionHint: 'Describe what you need in detail...',
    attachPhotos: 'Attach Photos', scheduleLabel: 'Schedule',
    scheduleNow: 'Now', scheduleLater: 'Pick a time',
    status: 'Status', quoteReceived: 'Quote Received',
    acceptQuote: 'Accept Quote', rejectQuote: 'Reject',
    confirmDone: 'Confirm Completion', raiseDispute: 'Raise Dispute',
    noOrders: 'No orders yet',
    downloadInvoice: 'Download Invoice',
    downloadInvoiceHint: 'Opens the PDF invoice in your browser',
    invoiceReady: 'Invoice ready',
    invoiceReadyDesc: 'Invoice number: {{number}}',
    invoiceError: 'Failed to generate invoice',
  },
  payment: {
    title: 'Payment', total: 'Total', method: 'Payment Method',
    card: 'Credit / Debit Card', applePay: 'Apple Pay',
    stcPay: 'STC Pay', cash: 'Cash on Delivery',
    vipps: 'Vipps', swish: 'Swish',
    escrowNote: 'Amount held until service is completed',
    payNow: 'Pay Now', success: 'Payment successful ✓',
    failed: 'Payment failed. Please try again.',
  },
  chat: {
    placeholder: 'Type a message...', send: 'Send',
    typing: 'typing...', today: 'Today', yesterday: 'Yesterday',
  },
  provider: {
    rating: 'Rating', reviews: 'reviews', services: 'Services',
    completedOrders: 'Completed', sendQuote: 'Send Quote',
    quotePrice: 'Price', quoteDuration: 'Est. Duration (minutes)',
    quoteNote: 'Notes (optional)', wallet: 'Wallet',
    balance: 'Available Balance', pending: 'Pending',
    requestPayout: 'Request Payout',
  },
  support: {
    offlineBanner: 'Showing saved version — offline',
    onlineBanner: 'Loading from workfix.app…', loadingLocal: 'Loading local content…',
    loadError: 'Failed to load the page', openBrowser: 'Open in Browser', lastUpdated: 'Last update of saved content',
  },
  privacy: {
    screenTitle: 'Privacy & My Data', introTitle: 'Your Rights',
    introText: 'Under GDPR (Art.17 & 20) and Saudi PDPL, you have the right to download your data or request account deletion.',
    exportTitle: 'Download My Data', exportDesc: 'Get a complete copy of all your personal data.',
    exportHint: 'A download link will be emailed to you within minutes',
    exportIncludesLabel: 'Includes:', exportIncludes: 'Profile · Orders · Messages · Reviews · Notifications',
    requestExport: 'Request Data Export', exportQueued: 'Request Queued',
    exportQueuedDesc: 'You will receive an email when your file is ready.', exportQueuedBadge: 'Preparing your file…',
    exportReady: 'File Ready', exportReadyDesc: 'Valid until: {{expiry}}', exportExpiresHint: 'Link valid until: {{expiry}}',
    download: 'Download',
    deleteTitle: 'Delete Account', deleteDesc: 'Permanently delete all your personal data.',
    deleteHint: 'Your account will be suspended immediately and deleted after 30 days',
    requestDeletion: 'Request Account Deletion', cancelDeletion: 'Cancel Deletion Request',
    cancelDeletionHint: 'Cancel the deletion request', deletionPending: 'Account deletion scheduled for: {{date}}',
    deletionCancelled: 'Deletion request cancelled', deletionCancelledDesc: 'Your account is active again.',
    deletionAlreadyRequested: 'Deletion already requested', deletionScheduled: 'Account deletion scheduled',
    retentionNote: 'Financial records are anonymised, not deleted — required by law.',
    deleteModalTitle: 'Warning: This action cannot be undone',
    deleteModalWarning: 'Your account will be suspended immediately and permanently deleted 30 days after confirmation.',
    deleteWillDelete: 'Will be permanently deleted:', deleteWillDeleteItems: 'Profile · Messages · Notifications · Login credentials',
    deleteWillKeep: 'Will be retained (anonymised):', deleteWillKeepItems: 'Order records · Financial transactions (7 years)',
    continueToDelete: 'Continue to Deletion', reasonTitle: 'Why are you leaving?',
    reason_no_longer_using: 'I no longer use the app', reason_privacy: 'Privacy concerns',
    reason_alternative: 'Found an alternative', reason_other: 'Other reason',
    confirmDeleteTitle: 'Confirm Permanent Deletion', confirmDeleteInstr: 'To confirm deletion, type exactly:',
    confirmDeleteBtn: 'Permanently Delete My Account', typeConfirmation: 'Type the confirmation phrase',
    gracePeriodNote: 'You can cancel this request within 30 days by signing in.',
    policiesTitle: 'Policies & Legal', contactDPO: 'Contact Data Protection Officer',
    legalNote: 'WorkFix complies with GDPR, Saudi PDPL, and applicable data protection laws.',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// NORWEGIAN BOKMÅL (NO) — LTR
// ─────────────────────────────────────────────────────────────────────────────

const no: Translations = {
  common: {
    loading: 'Laster...', error: 'Noe gikk galt', retry: 'Prøv igjen',
    cancel: 'Avbryt', confirm: 'Bekreft', save: 'Lagre', close: 'Lukk',
    search: 'Søk', back: 'Tilbake', next: 'Neste', done: 'Ferdig',
    yes: 'Ja', no: 'Nei', sar: 'kr', km: 'km', minutes: 'min',
  },
  auth: {
    welcome: 'Velkommen til WorkFix', tagline: 'Bestill tjenesten din på minutter',
    loginTitle: 'Logg inn', registerTitle: 'Opprett konto',
    email: 'E-post', password: 'Passord', phone: 'Telefonnummer',
    otp: 'Bekreftelseskode', otpSent: 'Kode sendt til {{phone}}',
    name: 'Fullt navn', iam: 'Jeg er...',
    customer: 'Kunde som søker en tjeneste', provider: 'Tjenesteleverandør',
    individual: 'Enkeltperson / Frilanser', company: 'Bedrift',
    businessName: 'Bedriftsnavn', kycTitle: 'Identitetsverifisering',
    kycDesc: 'Vennligst last opp nasjonalt ID eller firmaregistrering',
    kycPending: 'Dokumentene dine er under vurdering. Du vil bli varslet ved godkjenning.',
    forgotPassword: 'Glemt passord?', orContinueWith: 'Eller fortsett med',
    google: 'Google', alreadyHaveAccount: 'Har du allerede en konto? Logg inn',
    noAccount: 'Har du ikke en konto? Registrer deg',
  },
  home: {
    greeting: 'Hei, {{name}} 👋', searchPlaceholder: 'Søk etter en tjeneste...',
    categories: 'Kategorier', nearbyProviders: 'Leverandører i nærheten',
    noProvidersNearby: 'Ingen leverandører i ditt område ennå', seeAll: 'Se alle',
  },
  orders: {
    title: 'Mine bestillinger', newOrder: 'Ny bestilling',
    descriptionLabel: 'Beskriv problemet',
    descriptionHint: 'Beskriv hva du trenger i detalj...',
    attachPhotos: 'Legg ved bilder', scheduleLabel: 'Planlegg',
    scheduleNow: 'Nå', scheduleLater: 'Velg tidspunkt',
    status: 'Status', quoteReceived: 'Tilbud mottatt',
    acceptQuote: 'Godta tilbud', rejectQuote: 'Avslå',
    confirmDone: 'Bekreft fullføring', raiseDispute: 'Åpne tvist',
    noOrders: 'Ingen bestillinger ennå',
    downloadInvoice: 'Last ned faktura',
    downloadInvoiceHint: 'Åpner PDF-fakturaen i nettleseren',
    invoiceReady: 'Faktura klar',
    invoiceReadyDesc: 'Fakturanummer: {{number}}',
    invoiceError: 'Kunne ikke generere faktura',
  },
  payment: {
    title: 'Betaling', total: 'Totalt', method: 'Betalingsmetode',
    card: 'Kreditt- / debetkort', applePay: 'Apple Pay',
    stcPay: 'STC Pay', cash: 'Kontant ved levering',
    vipps: 'Vipps', swish: 'Swish',
    escrowNote: 'Beløpet holdes tilbake til tjenesten er fullført',
    payNow: 'Betal nå', success: 'Betaling vellykket ✓',
    failed: 'Betalingen mislyktes. Vennligst prøv igjen.',
  },
  chat: {
    placeholder: 'Skriv en melding...', send: 'Send',
    typing: 'skriver...', today: 'I dag', yesterday: 'I går',
  },
  provider: {
    rating: 'Vurdering', reviews: 'anmeldelser', services: 'Tjenester',
    completedOrders: 'Fullførte', sendQuote: 'Send tilbud',
    quotePrice: 'Pris (kr)', quoteDuration: 'Estimert varighet (minutter)',
    quoteNote: 'Merknader (valgfritt)', wallet: 'Lommebok',
    balance: 'Tilgjengelig saldo', pending: 'Venter',
    requestPayout: 'Be om utbetaling',
  },
  support: {
    offlineBanner: 'Viser lagret versjon — frakoblet',
    onlineBanner: 'Laster fra workfix.app…', loadingLocal: 'Laster lokalt innhold…',
    loadError: 'Klarte ikke å laste siden', openBrowser: 'Åpne i nettleser', lastUpdated: 'Sist oppdatert lokalt innhold',
  },
  privacy: {
    screenTitle: 'Personvern og mine data', introTitle: 'Dine rettigheter',
    introText: 'I henhold til GDPR har du rett til å laste ned dataene dine eller be om sletting.',
    exportTitle: 'Last ned mine data', exportDesc: 'Få en komplett kopi av dine personopplysninger.',
    exportHint: 'En nedlastingslenke sendes til e-posten din', exportIncludesLabel: 'Inkluderer:',
    exportIncludes: 'Profil · Bestillinger · Meldinger · Anmeldelser',
    requestExport: 'Be om dataeksport', exportQueued: 'Forespørsel i kø',
    exportQueuedDesc: 'Du mottar en e-post når filen er klar.', exportQueuedBadge: 'Forbereder filen…',
    exportReady: 'Fil klar', exportReadyDesc: 'Gyldig til: {{expiry}}', exportExpiresHint: 'Lenke gyldig til: {{expiry}}',
    download: 'Last ned',
    deleteTitle: 'Slett konto', deleteDesc: 'Slett alle dine personopplysninger permanent.',
    deleteHint: 'Kontoen suspenderes og slettes etter 30 dager',
    requestDeletion: 'Be om kontosletting', cancelDeletion: 'Avbryt slettingsforespørsel',
    cancelDeletionHint: 'Avbryt forespørselen', deletionPending: 'Kontosletting planlagt: {{date}}',
    deletionCancelled: 'Sletting avbrutt', deletionCancelledDesc: 'Kontoen din er aktiv igjen.',
    deletionAlreadyRequested: 'Sletting allerede forespurt', deletionScheduled: 'Kontosletting planlagt',
    retentionNote: 'Finansielle poster anonymiseres — lovpålagt krav.',
    deleteModalTitle: 'Advarsel: Kan ikke angres',
    deleteModalWarning: 'Kontoen suspenderes umiddelbart og slettes 30 dager etter bekreftelse.',
    deleteWillDelete: 'Slettes permanent:', deleteWillDeleteItems: 'Profil · Meldinger · Varsler',
    deleteWillKeep: 'Beholdes (anonymisert):', deleteWillKeepItems: 'Bestillingslogger · Finansielle poster',
    continueToDelete: 'Fortsett', reasonTitle: 'Hvorfor forlater du?',
    reason_no_longer_using: 'Bruker ikke appen lenger', reason_privacy: 'Personvernbekymringer',
    reason_alternative: 'Fant et alternativ', reason_other: 'Annen grunn',
    confirmDeleteTitle: 'Bekreft permanent sletting', confirmDeleteInstr: 'Skriv nøyaktig:',
    confirmDeleteBtn: 'Slett kontoen min permanent', typeConfirmation: 'Skriv bekreftelsesfransen',
    gracePeriodNote: 'Du kan avbryte innen 30 dager ved å logge inn.',
    policiesTitle: 'Retningslinjer', contactDPO: 'Kontakt personvernansvarlig',
    legalNote: 'WorkFix overholder GDPR og norsk personvernlovgivning.',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SWEDISH (SV) — LTR
// ─────────────────────────────────────────────────────────────────────────────

const sv: Translations = {
  common: {
    loading: 'Laddar...', error: 'Något gick fel', retry: 'Försök igen',
    cancel: 'Avbryt', confirm: 'Bekräfta', save: 'Spara', close: 'Stäng',
    search: 'Sök', back: 'Tillbaka', next: 'Nästa', done: 'Klar',
    yes: 'Ja', no: 'Nej', sar: 'kr', km: 'km', minutes: 'min',
  },
  auth: {
    welcome: 'Välkommen till WorkFix', tagline: 'Boka din tjänst på minuter',
    loginTitle: 'Logga in', registerTitle: 'Skapa konto',
    email: 'E-post', password: 'Lösenord', phone: 'Telefonnummer',
    otp: 'Verifieringskod', otpSent: 'Kod skickad till {{phone}}',
    name: 'Fullständigt namn', iam: 'Jag är...',
    customer: 'Kund som söker en tjänst', provider: 'Tjänsteleverantör',
    individual: 'Privatperson / Frilansare', company: 'Företag',
    businessName: 'Företagsnamn', kycTitle: 'Identitetsverifiering',
    kycDesc: 'Ladda upp nationellt ID eller företagsregistrering',
    kycPending: 'Dina dokument granskas. Du meddelas när de godkänts.',
    forgotPassword: 'Glömt lösenordet?', orContinueWith: 'Eller fortsätt med',
    google: 'Google', alreadyHaveAccount: 'Har du redan ett konto? Logga in',
    noAccount: 'Har du inget konto? Registrera dig',
  },
  home: {
    greeting: 'Hej, {{name}} 👋', searchPlaceholder: 'Sök efter en tjänst...',
    categories: 'Kategorier', nearbyProviders: 'Leverantörer i närheten',
    noProvidersNearby: 'Inga leverantörer i ditt område ännu', seeAll: 'Se alla',
  },
  orders: {
    title: 'Mina beställningar', newOrder: 'Ny beställning',
    descriptionLabel: 'Beskriv problemet',
    descriptionHint: 'Beskriv vad du behöver i detalj...',
    attachPhotos: 'Bifoga bilder', scheduleLabel: 'Schemalägg',
    scheduleNow: 'Nu', scheduleLater: 'Välj tid',
    status: 'Status', quoteReceived: 'Offert mottagen',
    acceptQuote: 'Godkänn offert', rejectQuote: 'Avvisa',
    confirmDone: 'Bekräfta slutförande', raiseDispute: 'Öppna tvist',
    noOrders: 'Inga beställningar ännu',
    downloadInvoice: 'Ladda ner faktura',
    downloadInvoiceHint: 'Öppnar PDF-fakturan i webbläsaren',
    invoiceReady: 'Faktura klar',
    invoiceReadyDesc: 'Fakturanummer: {{number}}',
    invoiceError: 'Det gick inte att generera faktura',
  },
  payment: {
    title: 'Betalning', total: 'Totalt', method: 'Betalningsmetod',
    card: 'Kredit- / betalkort', applePay: 'Apple Pay',
    stcPay: 'STC Pay', cash: 'Kontant vid leverans',
    vipps: 'Vipps', swish: 'Swish',
    escrowNote: 'Beloppet hålls inne tills tjänsten är slutförd',
    payNow: 'Betala nu', success: 'Betalning lyckades ✓',
    failed: 'Betalningen misslyckades. Försök igen.',
  },
  chat: {
    placeholder: 'Skriv ett meddelande...', send: 'Skicka',
    typing: 'skriver...', today: 'Idag', yesterday: 'Igår',
  },
  provider: {
    rating: 'Betyg', reviews: 'recensioner', services: 'Tjänster',
    completedOrders: 'Slutförda', sendQuote: 'Skicka offert',
    quotePrice: 'Pris (kr)', quoteDuration: 'Uppskattad tid (minuter)',
    quoteNote: 'Anteckningar (valfritt)', wallet: 'Plånbok',
    balance: 'Tillgängligt saldo', pending: 'Väntar',
    requestPayout: 'Begär utbetalning',
  },
  support: {
    offlineBanner: 'Visar sparad version — offline',
    onlineBanner: 'Laddar från workfix.app…', loadingLocal: 'Laddar lokalt innehåll…',
    loadError: 'Det gick inte att ladda sidan', openBrowser: 'Öppna i webbläsare', lastUpdated: 'Senast uppdaterat lokalt innehåll',
  },
  privacy: {
    screenTitle: 'Integritet och mina data', introTitle: 'Dina rättigheter',
    introText: 'Enligt GDPR har du rätt att ladda ner dina data eller begära radering.',
    exportTitle: 'Ladda ner mina data', exportDesc: 'Hämta en komplett kopia av dina personuppgifter.',
    exportHint: 'En nedladdningslänk skickas till din e-post', exportIncludesLabel: 'Inkluderar:',
    exportIncludes: 'Profil · Beställningar · Meddelanden · Recensioner',
    requestExport: 'Begär dataexport', exportQueued: 'Begäran i kö',
    exportQueuedDesc: 'Du får ett e-postmeddelande när filen är klar.', exportQueuedBadge: 'Förbereder filen…',
    exportReady: 'Fil redo', exportReadyDesc: 'Giltig till: {{expiry}}', exportExpiresHint: 'Länk giltig till: {{expiry}}',
    download: 'Ladda ner',
    deleteTitle: 'Radera konto', deleteDesc: 'Radera alla dina personuppgifter permanent.',
    deleteHint: 'Ditt konto stängs av och raderas efter 30 dagar',
    requestDeletion: 'Begär kontoradering', cancelDeletion: 'Avbryt raderingsförfrågan',
    cancelDeletionHint: 'Avbryt förfrågan', deletionPending: 'Kontoradering schemalagd: {{date}}',
    deletionCancelled: 'Radering avbruten', deletionCancelledDesc: 'Ditt konto är aktivt igen.',
    deletionAlreadyRequested: 'Radering redan begärd', deletionScheduled: 'Kontoradering schemalagd',
    retentionNote: 'Finansiella poster anonymiseras — lagstadgat krav.',
    deleteModalTitle: 'Varning: Kan inte ångras',
    deleteModalWarning: 'Kontot stängs av omedelbart och raderas 30 dagar efter bekräftelse.',
    deleteWillDelete: 'Raderas permanent:', deleteWillDeleteItems: 'Profil · Meddelanden · Aviseringar',
    deleteWillKeep: 'Behålls (anonymiserat):', deleteWillKeepItems: 'Beställningsloggar · Finansiella poster',
    continueToDelete: 'Fortsätt', reasonTitle: 'Varför lämnar du?',
    reason_no_longer_using: 'Använder inte appen längre', reason_privacy: 'Integritetsproblem',
    reason_alternative: 'Hittade ett alternativ', reason_other: 'Annan anledning',
    confirmDeleteTitle: 'Bekräfta permanent radering', confirmDeleteInstr: 'Skriv exakt:',
    confirmDeleteBtn: 'Radera mitt konto permanent', typeConfirmation: 'Skriv bekräftelsefrasen',
    gracePeriodNote: 'Du kan avbryta inom 30 dagar genom att logga in.',
    policiesTitle: 'Policyer', contactDPO: 'Kontakta dataskyddsombud',
    legalNote: 'WorkFix följer GDPR och svenska dataskyddslagar.',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// RTL DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/** Only Arabic is RTL — Norwegian and Swedish are strictly LTR */
export function isRtlLocale(lang: SupportedLocale): boolean {
  return lang === 'ar'
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

const EXTRA_AR = {
  tabs: { home: 'الرئيسية', orders: 'طلباتي', messages: 'الرسائل', profile: 'حسابي' },
  auth: {
    addDocument: 'إضافة مستند', businessNamePlaceholder: 'اسم شركتك أو مؤسستك',
    company: 'شركة', companyDesc: 'شركة أو مؤسسة تضم فريقاً من المزوّدين',
    createAccount: 'إنشاء حساب', getStarted: 'ابدأ الآن', goToHome: 'الذهاب للرئيسية',
    iam: 'أنا', individualDesc: 'تعمل باستقلالية وتقدّم خدماتك بشكل شخصي',
    kycHint1: 'صورة واضحة للهوية الوطنية أو جواز السفر',
    kycHint2: 'للشركات: السجل التجاري أو رخصة العمل',
    kycHint3: 'يجب أن تكون الصورة واضحة وغير مقطوعة',
    kycPendingTitle: 'تحت المراجعة', namePlaceholder: 'الاسم الثلاثي',
    orContinueWith: 'أو تابع باستخدام', password: 'كلمة المرور',
    passwordHint: 'يجب أن يكون 8 أحرف على الأقل', phoneHint: 'مثال: +966501234567',
    providerTypeSubtitle: 'اختر نوع حسابك كمزوّد خدمة', providerTypeTitle: 'نوع حسابك',
    registerTitle: 'إنشاء حساب', resendIn: 'إعادة الإرسال خلال {{seconds}}ث',
    resendOtp: 'إعادة الإرسال', sendOtp: 'إرسال رمز التحقق',
    submitKyc: 'إرسال المستندات', tagline: 'خدمات موثوقة بين يديك', verify: 'تحقق',
  },
  chat: {
    attachImage: 'إرفاق صورة', choosePhoto: 'اختر من المكتبة', title: 'المحادثة',
    noConversations: 'لا محادثات بعد', noConversationsDesc: 'ستبدأ المحادثات بعد قبول عرض سعر',
    startConversation: 'ابدأ المحادثة مع المزوّد', takePhoto: 'التقط صورة',
    typing: 'يكتب...', placeholder: 'اكتب رسالة...', yes: 'نعم',
  },
  common: {
    all: 'الكل', back: 'رجوع', cancel: 'إلغاء', done: 'تم', error: 'خطأ',
    km: 'كم', minutes: 'دقيقة', next: 'التالي', retry: 'إعادة المحاولة',
    there: 'صديقنا', sar: 'ر.س',
  },
  errors: {
    insufficientBalance: 'الرصيد غير كافٍ', invalidAmount: 'مبلغ غير صحيح',
    invalidDuration: 'مدة غير صحيحة', invalidEmail: 'بريد إلكتروني غير صحيح',
    invalidPhone: 'رقم الهاتف غير صحيح', invalidPrice: 'سعر غير صحيح',
    kycRequired: 'يرجى رفع مستند واحد على الأقل',
    minPayout: 'الحد الأدنى للسحب 10 وحدات', nameTooShort: 'الاسم قصير جداً',
    passwordTooShort: 'كلمة المرور قصيرة جداً', uploadFailed: 'فشل رفع الملف، حاول مجدداً',
    unauthenticated: 'يجب تسجيل الدخول أولاً', permissionDenied: 'ليس لديك صلاحية لهذا الإجراء',
    notFound: 'العنصر غير موجود', rateLimitExceeded: 'كثير من الطلبات، حاول بعد قليل',
  },
  home: {
    backHome: 'العودة للرئيسية', categories: 'الفئات', greeting: 'أهلاً {{name}}',
    nearbyProviders: 'مزوّدون قريبون', noProvidersNearby: 'لا مزوّدين قريبين',
    quickActions: 'إجراءات سريعة', searchPlaceholder: 'ابحث عن خدمة...',
    seeAll: 'عرض الكل', tryExpandingRadius: 'جرّب توسيع نطاق البحث',
    welcome: 'مرحباً',
  },
  notifications: {
    title: 'الإشعارات', empty: 'لا إشعارات حتى الآن',
    emptyDesc: 'ستصلك إشعارات عند تحديث طلباتك', markAllRead: 'تعيين الكل كمقروء',
  },
  onboarding: {
    skip: 'تخطي',
    slide1_title: 'اعثر على خبراء قريبين منك', slide1_sub: 'آلاف المزوّدين المحترفين في منطقتك',
    slide2_title: 'احجز بكل ثقة', slide2_sub: 'تقييمات حقيقية وأسعار شفافة قبل الحجز',
    slide3_title: 'ادفع بأمان', slide3_sub: 'مبلغك محتجز حتى تتأكد من إتمام الخدمة',
  },
  orders: {
    addPhoto: 'إضافة صورة', addressHint: 'الحي، الشارع، رقم المبنى',
    addressLabel: 'العنوان', addressPlaceholder: 'أدخل عنوانك التفصيلي',
    attachPhotos: 'إرفاق صور', confirmDone: 'تأكيد الإنجاز',
    confirmDoneDesc: 'بمجرد التأكيد سيتم تحرير المبلغ للمزوّد',
    createdAt: 'تاريخ الإنشاء', describeStep: 'صِف المشكلة',
    describeStepSub: 'كلما كان الوصف دقيقاً كلما تلقيت عروضاً أفضل',
    descriptionLabel: 'الوصف', details: 'تفاصيل الطلب',
    locationRequired: 'يرجى تفعيل خدمة الموقع', locationStep: 'موقعك',
    locationStepSub: 'سيستخدم المزوّد هذا العنوان للوصول إليك',
    newOrder: 'طلب جديد', noOrders: 'لا طلبات بعد', noOrdersDesc: 'ابدأ بإنشاء طلبك الأول',
    photos: 'الصور', photosCount: 'صورة', price: 'السعر',
    quoteAccepted: 'تم قبول العرض', quoteExpired: 'انتهت صلاحية العرض',
    quoteRejected: 'تم رفض العرض', quoteSentSuccess: 'تم إرسال عرضك بنجاح',
    quotes: 'العروض', raiseDispute: 'رفع نزاع', rejectQuote: 'رفض العرض',
    rejectQuoteConfirm: 'هل أنت متأكد من رفض هذا العرض؟', scheduleLabel: 'الموعد',
    scheduleLater: 'لاحقاً', scheduleLaterDesc: 'حدد وقتاً محدداً',
    scheduleNow: 'الآن', scheduleNowDesc: 'المزوّد سيتواصل معك فوراً',
    scheduleStep: 'الموعد', scheduleStepSub: 'هل تريد الخدمة الآن أم في وقت محدد؟',
    scheduledAt: 'الموعد المجدول', submitOrder: 'إرسال الطلب', summary: 'ملخص الطلب',
    title: 'طلباتي', waitingForQuotes: 'بانتظار عروض الأسعار من المزوّدين',
  },
  payment: {
    applePay: 'Apple Pay', card: 'بطاقة', cash: 'نقداً', escrowNote: 'محمي بالضمان',
    failed: 'فشل الدفع', mada: 'مدى', payNow: 'ادفع الآن', stcPay: 'STC Pay',
    swish: 'Swish', title: 'الدفع', vipps: 'Vipps',
    cancelDesc: 'هل تريد إلغاء عملية الدفع؟ سيبقى طلبك مؤكداً.',
    cancelPayment: 'إلغاء الدفع', cancelTitle: 'إلغاء الدفع',
    cashHint: 'ادفع نقداً للمزوّد عند إتمام الخدمة',
    continuePaying: 'متابعة الدفع',
    escrowStep1: 'دفعك محتجز بأمان حتى إتمام الخدمة',
    escrowStep2: 'بعد تأكيدك يُحوَّل المبلغ للمزوّد',
    escrowStep3: 'في حالة نزاع المبلغ محفوظ لك',
    escrowTitle: 'كيف تعمل الحماية؟',
    failedDesc: 'لم تكتمل عملية الدفع. يمكنك المحاولة مجدداً.',
    invalidSession: 'جلسة الدفع غير صالحة', loadError: 'تعذّر تحميل صفحة الدفع',
    loading: 'جارٍ تحميل صفحة الدفع...', method: 'طريقة الدفع',
    securePayment: 'دفع آمن', serviceAmount: 'قيمة الخدمة',
    success: 'تم الدفع بنجاح! 🎉', successDesc: 'مبلغك محتجز بأمان حتى إتمام الخدمة',
    terms: 'بالمتابعة أنت توافق على الشروط والأحكام',
    total: 'الإجمالي', trackOrder: 'متابعة الطلب', tryAgain: 'حاول مجدداً',
    vat: 'ضريبة القيمة المضافة', status_held: 'محتجز', status_captured: 'مكتمل', status_refunded: 'مُسترد',
  },
  profile: {
    account: 'الحساب', anonymous: 'مستخدم', changePassword: 'تغيير كلمة المرور',
    contactUs: 'تواصل معنا', editProfile: 'تعديل الملف', faq: 'الأسئلة الشائعة',
    language: 'اللغة', languageHint: 'تغيير الاتجاه من AR إلى EN يعيد تحميل التطبيق',
    myServices: 'خدماتي', notifications: 'الإشعارات', privacy: 'سياسة الخصوصية',
    providerTools: 'أدوات المزوّد', rateApp: 'قيّم التطبيق', signOut: 'تسجيل الخروج',
    signOutDesc: 'هل أنت متأكد من تسجيل الخروج؟', signOutTitle: 'تسجيل الخروج',
    statistics: 'الإحصاءات', support: 'الدعم', terms: 'الشروط والأحكام',
    bankAccount: 'الحساب البنكي',
  },
  provider: {
    about: 'عن المزوّد', balance: 'الرصيد المتاح', bankAccount: 'الحساب البنكي',
    bankAccountDesc: 'أضف حسابك لاستلام المدفوعات', bookNow: 'احجز الآن',
    completedOrders: 'طلبات مكتملة', dashboard: 'لوحة التحكم', dayOff: 'عطلة',
    history: 'السابقة', howPayoutWorks: 'كيف تعمل السحوبات؟',
    leaveBlankForFull: 'اتركه فارغاً لسحب كل الرصيد', newRequests: 'طلبات جديدة',
    noOrders: 'لا طلبات بعد', noOrdersDesc: 'ستظهر هنا طلبات العملاء القريبين',
    noReviews: 'لا تقييمات بعد', ongoing: 'جارية',
    payoutAmountPlaceholder: 'المبلغ المطلوب', payoutInfo1: 'المبلغ يُحوَّل بعد 24 ساعة من إغلاق الطلب',
    payoutInfo2: 'الحد الأدنى للسحب 10 وحدات', payoutInfo3: 'يستغرق التحويل 1-3 أيام عمل',
    payoutRequested: 'تم إرسال طلب السحب بنجاح', pending: 'معلّق',
    processing: 'قيد المعالجة', provider: 'المزوّد', quoteDuration: 'المدة التقديرية (دقيقة)',
    quoteNote: 'ملاحظة', quoteNotePlaceholder: 'ملاحظات إضافية للعميل...',
    quotePrice: 'السعر', rating: 'التقييم', requestPayout: 'طلب سحب',
    reviews: 'التقييمات', sendQuote: 'إرسال عرض سعر', verified: 'موثّق',
    wallet: 'المحفظة', workingHours: 'ساعات العمل',
  },
  disputes: {
    title: 'رفع نزاع', warningDesc: 'سيتم تجميد مبلغ الطلب حتى يُحسم النزاع من قِبَل الإدارة.',
    selectReasonLabel: 'سبب النزاع', descriptionLabel: 'وصف المشكلة',
    descriptionPlaceholder: 'اشرح المشكلة بالتفصيل...', descriptionHint: '20 حرف على الأقل',
    evidence: 'الأدلة', evidenceHint: 'أرفق صوراً أو مستندات داعمة',
    addEvidence: 'إضافة دليل', submit: 'إرسال النزاع',
    submitted: 'تم إرسال النزاع', submittedDesc: 'سيراجع فريقنا نزاعك خلال 24-48 ساعة.',
    submitFailed: 'فشل إرسال النزاع', selectReason: 'يرجى اختيار سبب',
    descriptionTooShort: 'يرجى كتابة وصف أطول (20 حرف على الأقل)',
  },
  reviews: {
    title: 'تقييم الخدمة', subtitle: 'كيف كانت تجربتك مع {{name}}؟',
    tapToRate: 'اضغط لتقييم', rating1: 'سيء جداً', rating2: 'سيء',
    rating3: 'مقبول', rating4: 'جيد', rating5: 'ممتاز!',
    whatStoodOut: 'ما الذي تميّز؟', addComment: 'أضف تعليقاً',
    commentPlaceholder: 'شارك تفاصيل تجربتك...', ratingRequired: 'التقييم مطلوب',
    pleaseRate: 'يرجى اختيار تقييم بالنجوم أولاً', submit: 'إرسال التقييم',
    submitFailed: 'فشل إرسال التقييم', skipForNow: 'تخطي الآن',
  },
  subscriptions: {
    title: 'الباقات', monthly: 'شهري', yearly: 'سنوي', save30: 'وفّر 30%',
    mostPopular: 'الأكثر شيوعاً', free: 'مجاني', month: 'شهر',
    tier_free: 'مجاني', tier_pro: 'Pro', tier_business: 'Business',
    billedAs: 'يُحسب سنوياً بـ {{total}} ر.س', subscribe: 'اشترك في {{tier}}',
    keepFree: 'البقاء على المجاني', activated: 'تم تفعيل الاشتراك بنجاح',
    alreadyFree: 'أنت على الخطة المجانية بالفعل',
    failed: 'فشل الاشتراك. يرجى المحاولة مجدداً', cancelAnytime: 'يمكن الإلغاء في أي وقت',
  },
  search: {
    results: 'نتيجة', noResults: 'لا توجد نتائج', tryDifferentKeyword: 'جرب كلمة بحث مختلفة',
    clearFilters: 'مسح الفلاتر', filters: 'الفلاتر', sortBy: 'ترتيب حسب',
    sort_distance: 'الأقرب', sort_rating: 'الأعلى تقييماً', sort_price: 'السعر',
    minRating: 'أقل تقييم', radius: 'نطاق البحث', applyFilters: 'تطبيق',
    resetFilters: 'إعادة تعيين',
  },
  a11y: {
    loading: 'جارٍ التحميل',
  },
}


const EXTRA_EN = {
  tabs:          { home: 'Home', orders: 'Orders', messages: 'Messages', profile: 'Profile' },
  auth: {
    addDocument: 'Add Document', businessNamePlaceholder: 'Your company or organization name',
    companyDesc: 'A company or organization with a team of providers',
    createAccount: 'Create Account', getStarted: 'Get Started', goToHome: 'Go to Home',
    individualDesc: 'Work independently and offer services personally',
    kycHint1: 'A clear photo of your national ID or passport',
    kycHint2: 'For companies: commercial registration or business license',
    kycHint3: 'The photo must be clear and not cropped',
    kycPendingTitle: 'Under Review', namePlaceholder: 'Full name',
    passwordHint: 'Must be at least 8 characters', phoneHint: 'Example: +4712345678',
    providerTypeSubtitle: 'Choose your account type as a service provider',
    providerTypeTitle: 'Account Type',
    resendIn: 'Resend in {{seconds}}s', resendOtp: 'Resend',
    sendOtp: 'Send Verification Code', submitKyc: 'Submit Documents',
    tagline: 'Trusted services at your fingertips', verify: 'Verify',
  },
  chat: {
    attachImage: 'Attach Image', choosePhoto: 'Choose from Library', title: 'Conversation',
    noConversations: 'No conversations yet',
    noConversationsDesc: 'Conversations start after accepting a quote',
    startConversation: 'Start conversation with provider', takePhoto: 'Take Photo',
  },
  common: { all: 'All', there: 'there' },
  errors: {
    insufficientBalance: 'Insufficient balance', invalidAmount: 'Invalid amount',
    invalidDuration: 'Invalid duration', invalidEmail: 'Invalid email',
    invalidPhone: 'Invalid phone number', invalidPrice: 'Invalid price',
    kycRequired: 'Please upload at least one document',
    minPayout: 'Minimum payout is 10 units', nameTooShort: 'Name is too short',
    passwordTooShort: 'Password is too short',
    uploadFailed: 'File upload failed, please try again',
    unauthenticated: 'You must be signed in', permissionDenied: 'You do not have permission for this action',
    notFound: 'Item not found', rateLimitExceeded: 'Too many requests, please try again shortly',
  },
  home: {
    backHome: 'Back to Home', quickActions: 'Quick Actions',
    tryExpandingRadius: 'Try expanding your search radius', welcome: 'Welcome',
  },
  onboarding: {
    skip: 'Skip',
    slide1_title: 'Find nearby experts',
    slide1_sub: 'Thousands of professional providers in your area',
    slide2_title: 'Book with confidence',
    slide2_sub: 'Real reviews and transparent prices before booking',
    slide3_title: 'Pay securely',
    slide3_sub: 'Your money is held until the service is confirmed complete',
  },
  orders: {
    addPhoto: 'Add Photo', addressHint: 'Neighbourhood, street, building number',
    addressLabel: 'Address', addressPlaceholder: 'Enter your full address',
    confirmDoneDesc: 'Once confirmed, the amount will be released to the provider',
    createdAt: 'Created at', describeStep: 'Describe the issue',
    describeStepSub: 'The more detailed the description, the better quotes you receive',
    details: 'Order Details',
    locationRequired: 'Please enable location services', locationStep: 'Your Location',
    locationStepSub: 'The provider will use this address to reach you',
    noOrdersDesc: 'Start by creating your first order',
    photos: 'Photos', photosCount: 'photos', price: 'Price',
    quoteAccepted: 'Quote accepted', quoteExpired: 'Quote expired',
    quoteRejected: 'Quote rejected', quoteSentSuccess: 'Your quote was sent successfully',
    quotes: 'Quotes', rejectQuoteConfirm: 'Are you sure you want to reject this quote?',
    scheduleLaterDesc: 'Set a specific time', scheduleNowDesc: 'Provider will contact you immediately',
    scheduleStep: 'Schedule', scheduleStepSub: 'Do you want the service now or at a specific time?',
    scheduledAt: 'Scheduled at', submitOrder: 'Submit Order', summary: 'Order Summary',
    waitingForQuotes: 'Waiting for quotes from providers',
  },
  payment: {
    cancelDesc: 'Do you want to cancel the payment? Your order will remain confirmed.',
    cancelPayment: 'Cancel Payment', cancelTitle: 'Cancel Payment',
    cashHint: 'Pay cash to the provider upon service completion',
    continuePaying: 'Continue Payment',
    escrowStep1: 'Your payment is held securely until service is completed',
    escrowStep2: 'After your confirmation the amount is transferred to the provider',
    escrowStep3: 'In case of dispute the amount is kept for you',
    escrowTitle: 'How does protection work?',
    failedDesc: 'The payment was not completed. You can try again.',
    invalidSession: 'Invalid payment session', loadError: 'Failed to load payment page',
    loading: 'Loading payment page...', mada: 'Mada',
    securePayment: 'Secure payment', serviceAmount: 'Service amount',
    successDesc: 'Your money is held securely until service is confirmed complete',
    terms: 'By continuing you agree to the terms and conditions',
    trackOrder: 'Track Order', tryAgain: 'Try Again',
    vat: 'VAT', status_held: 'Held', status_captured: 'Completed', status_refunded: 'Refunded',
  },
  profile: {
    account: 'Account', anonymous: 'User', changePassword: 'Change Password',
    contactUs: 'Contact Us', editProfile: 'Edit Profile', faq: 'FAQ',
    language: 'Language', languageHint: 'Switching from AR to EN will reload the app',
    myServices: 'My Services', notifications: 'Notifications', privacy: 'Privacy Policy',
    providerTools: 'Provider Tools', rateApp: 'Rate App', signOut: 'Sign Out',
    signOutDesc: 'Are you sure you want to sign out?', signOutTitle: 'Sign Out',
    statistics: 'Statistics', support: 'Support', terms: 'Terms & Conditions',
    bankAccount: 'Bank Account',
  },
  provider: {
    about: 'About Provider', bankAccountDesc: 'Add your account to receive payments',
    bookNow: 'Book Now', dashboard: 'Dashboard', dayOff: 'Day off',
    history: 'History', howPayoutWorks: 'How do payouts work?',
    leaveBlankForFull: 'Leave blank to withdraw full balance', newRequests: 'New Requests',
    noOrdersDesc: 'Customer requests from nearby will appear here',
    noReviews: 'No reviews yet', ongoing: 'Ongoing',
    payoutAmountPlaceholder: 'Amount requested',
    payoutInfo1: 'Amount transferred 24 hours after order closes',
    payoutInfo2: 'Minimum payout is 10 units',
    payoutInfo3: 'Transfer takes 1–3 business days',
    payoutRequested: 'Payout request sent successfully', processing: 'Processing',
    provider: 'Provider', quoteNotePlaceholder: 'Additional notes for the customer...',
    verified: 'Verified', workingHours: 'Working Hours',
  },
  notifications: {
    title: 'Notifications', empty: 'No notifications yet',
    emptyDesc: 'You\'ll be notified when your orders are updated', markAllRead: 'Mark all as read',
  },
  reviews: {
    title: 'Rate Service', subtitle: 'How was your experience with {{name}}?',
    tapToRate: 'Tap to rate', rating1: 'Very bad', rating2: 'Bad',
    rating3: 'Okay', rating4: 'Good', rating5: 'Excellent!',
    whatStoodOut: 'What stood out?', addComment: 'Add a comment',
    commentPlaceholder: 'Share details about your experience...', ratingRequired: 'Rating required',
    pleaseRate: 'Please choose a star rating first', submit: 'Submit Review',
    submitFailed: 'Failed to submit review', skipForNow: 'Skip for now',
  },
  disputes: {
    title: 'Raise Dispute', warningDesc: 'The order amount will be frozen until the dispute is resolved by our team.',
    selectReasonLabel: 'Dispute reason', descriptionLabel: 'Describe the problem',
    descriptionPlaceholder: 'Explain the issue in detail...', descriptionHint: 'At least 20 characters',
    evidence: 'Evidence', evidenceHint: 'Attach supporting photos or documents',
    addEvidence: 'Add Evidence', submit: 'Submit Dispute',
    submitted: 'Dispute Submitted', submittedDesc: 'Our team will review your dispute within 24–48 hours.',
    submitFailed: 'Failed to submit dispute', selectReason: 'Please select a reason',
    descriptionTooShort: 'Please write a longer description (at least 20 characters)',
  },
  subscriptions: {
    title: 'Plans', monthly: 'Monthly', yearly: 'Yearly', save30: 'Save 30%',
    mostPopular: 'Most Popular', free: 'Free', month: 'mo',
    tier_free: 'Free', tier_pro: 'Pro', tier_business: 'Business',
    billedAs: 'Billed yearly at {{total}} SAR',
    subscribe: 'Subscribe to {{tier}}', keepFree: 'Stay on Free',
    activated: 'Subscription activated!', alreadyFree: 'You\'re already on the Free plan',
    failed: 'Subscription failed. Please try again', cancelAnytime: 'Cancel anytime',
  },
  search: {
    results: 'results', noResults: 'No results found', tryDifferentKeyword: 'Try a different keyword',
    clearFilters: 'Clear filters', filters: 'Filters', sortBy: 'Sort by',
    sort_distance: 'Nearest', sort_rating: 'Highest rated', sort_price: 'Price',
    minRating: 'Min rating', radius: 'Search radius', applyFilters: 'Apply',
    resetFilters: 'Reset',
  },
  a11y: {
    loading: 'Loading',
  },
}

const EXTRA_NO = {
  tabs:          { home: 'Hjem', orders: 'Bestillinger', messages: 'Meldinger', profile: 'Profil' },
  auth: {
    addDocument: 'Legg til dokument', businessNamePlaceholder: 'Firmaets eller organisasjonens navn',
    companyDesc: 'Et firma eller en organisasjon med et team av leverandører',
    createAccount: 'Opprett konto', getStarted: 'Kom i gang', goToHome: 'Gå til forsiden',
    individualDesc: 'Jobbe selvstendig og tilby tjenester personlig',
    kycHint1: 'Et klart bilde av ditt nasjonale ID eller pass',
    kycHint2: 'For bedrifter: firmaregistrering eller næringslisens',
    kycHint3: 'Bildet må være tydelig og ikke beskåret',
    kycPendingTitle: 'Under vurdering', namePlaceholder: 'Fullt navn',
    passwordHint: 'Må være minst 8 tegn', phoneHint: 'Eksempel: +4712345678',
    providerTypeSubtitle: 'Velg din kontotype som tjenesteleverandør',
    providerTypeTitle: 'Kontotype',
    resendIn: 'Send på nytt om {{seconds}}s', resendOtp: 'Send på nytt',
    sendOtp: 'Send bekreftelseskode', submitKyc: 'Send inn dokumenter',
    tagline: 'Pålitelige tjenester ved fingertuppene', verify: 'Bekreft',
  },
  chat: {
    attachImage: 'Legg ved bilde', choosePhoto: 'Velg fra bibliotek', title: 'Samtale',
    noConversations: 'Ingen samtaler ennå',
    noConversationsDesc: 'Samtaler starter etter at du godtar et tilbud',
    startConversation: 'Start samtale med leverandør', takePhoto: 'Ta bilde',
  },
  common: { all: 'Alle', there: 'der' },
  errors: {
    insufficientBalance: 'Utilstrekkelig saldo', invalidAmount: 'Ugyldig beløp',
    invalidDuration: 'Ugyldig varighet', invalidEmail: 'Ugyldig e-post',
    invalidPhone: 'Ugyldig telefonnummer', invalidPrice: 'Ugyldig pris',
    kycRequired: 'Last opp minst ett dokument',
    minPayout: 'Minste utbetaling er 10 enheter', nameTooShort: 'Navnet er for kort',
    passwordTooShort: 'Passordet er for kort',
    uploadFailed: 'Filopplasting mislyktes, prøv igjen',
    unauthenticated: 'Du må logge inn', permissionDenied: 'Du har ikke tillatelse til denne handlingen',
    notFound: 'Elementet ble ikke funnet', rateLimitExceeded: 'For mange forespørsler, prøv igjen om litt',
  },
  home: {
    backHome: 'Tilbake til forsiden', quickActions: 'Hurtighandlinger',
    tryExpandingRadius: 'Prøv å utvide søkeradius', welcome: 'Velkommen',
  },
  onboarding: {
    skip: 'Hopp over',
    slide1_title: 'Finn eksperter i nærheten',
    slide1_sub: 'Tusenvis av profesjonelle leverandører i ditt område',
    slide2_title: 'Bestill med trygghet',
    slide2_sub: 'Ekte anmeldelser og transparente priser før bestilling',
    slide3_title: 'Betal trygt',
    slide3_sub: 'Pengene dine holdes tilbake til tjenesten er bekreftet fullført',
  },
  orders: {
    addPhoto: 'Legg til bilde', addressHint: 'Nabolag, gate, bygningsnummer',
    addressLabel: 'Adresse', addressPlaceholder: 'Skriv inn din fulle adresse',
    confirmDoneDesc: 'Etter bekreftelse vil beløpet bli frigitt til leverandøren',
    createdAt: 'Opprettet', describeStep: 'Beskriv problemet',
    describeStepSub: 'Jo mer detaljert beskrivelsen er, desto bedre tilbud får du',
    details: 'Bestillingsdetaljer',
    locationRequired: 'Aktiver posisjonstjenester', locationStep: 'Din posisjon',
    locationStepSub: 'Leverandøren bruker denne adressen for å finne deg',
    noOrdersDesc: 'Start med å opprette din første bestilling',
    photos: 'Bilder', photosCount: 'bilder', price: 'Pris',
    quoteAccepted: 'Tilbud akseptert', quoteExpired: 'Tilbud utløpt',
    quoteRejected: 'Tilbud avslått', quoteSentSuccess: 'Tilbudet ditt ble sendt',
    quotes: 'Tilbud', rejectQuoteConfirm: 'Er du sikker på at du vil avslå dette tilbudet?',
    scheduleLaterDesc: 'Angi et spesifikt tidspunkt',
    scheduleNowDesc: 'Leverandøren kontakter deg umiddelbart',
    scheduleStep: 'Planlegg', scheduleStepSub: 'Vil du ha tjenesten nå eller på et bestemt tidspunkt?',
    scheduledAt: 'Planlagt tidspunkt', submitOrder: 'Send bestilling', summary: 'Bestillingssammendrag',
    waitingForQuotes: 'Venter på tilbud fra leverandører',
  },
  payment: {
    cancelDesc: 'Vil du avbryte betalingen? Bestillingen din forblir bekreftet.',
    cancelPayment: 'Avbryt betaling', cancelTitle: 'Avbryt betaling',
    cashHint: 'Betal kontant til leverandøren ved fullføring',
    continuePaying: 'Fortsett betaling',
    escrowStep1: 'Betalingen din holdes trygt til tjenesten er fullført',
    escrowStep2: 'Etter bekreftelsen overføres beløpet til leverandøren',
    escrowStep3: 'Ved tvist beholdes beløpet for deg',
    escrowTitle: 'Hvordan fungerer beskyttelsen?',
    failedDesc: 'Betalingen ble ikke fullført. Du kan prøve igjen.',
    invalidSession: 'Ugyldig betalingsøkt', loadError: 'Kunne ikke laste betalingssiden',
    loading: 'Laster betalingssiden...', mada: 'Mada',
    securePayment: 'Sikker betaling', serviceAmount: 'Tjenestebeløp',
    successDesc: 'Pengene dine holdes trygt til tjenesten er bekreftet fullført',
    terms: 'Ved å fortsette godtar du vilkårene og betingelsene',
    trackOrder: 'Spor bestilling', tryAgain: 'Prøv igjen',
    vat: 'MVA', status_held: 'Tilbakeholdt', status_captured: 'Fullført', status_refunded: 'Refundert',
  },
  provider: {
    about: 'Om leverandøren', bankAccountDesc: 'Legg til konto for å motta betalinger',
    bookNow: 'Bestill nå', dashboard: 'Dashbord', dayOff: 'Fridag',
    history: 'Historikk', howPayoutWorks: 'Hvordan fungerer utbetalinger?',
    leaveBlankForFull: 'La stå tomt for å ta ut hele saldoen', newRequests: 'Nye forespørsler',
    noOrdersDesc: 'Kundeforespørsler fra nærheten vil vises her',
    noReviews: 'Ingen anmeldelser ennå', ongoing: 'Pågående',
    payoutAmountPlaceholder: 'Ønsket beløp',
    payoutInfo1: 'Beløp overføres 24 timer etter at bestillingen lukkes',
    payoutInfo2: 'Minste utbetaling er 10 enheter',
    payoutInfo3: 'Overføringen tar 1–3 virkedager',
    payoutRequested: 'Utbetalingsforespørsel sendt', processing: 'Behandler',
    provider: 'Leverandør', quoteNotePlaceholder: 'Tilleggsnotater til kunden...',
    verified: 'Verifisert', workingHours: 'Arbeidstider',
  },
  profile: {
    account: 'Konto', anonymous: 'Bruker', changePassword: 'Endre passord',
    contactUs: 'Kontakt oss', editProfile: 'Rediger profil', faq: 'Vanlige spørsmål',
    language: 'Språk', languageHint: 'Bytte mellom AR og EN starter appen på nytt',
    myServices: 'Mine tjenester', notifications: 'Varsler', privacy: 'Personvernerklæring',
    providerTools: 'Leverandørverktøy', rateApp: 'Vurder appen', signOut: 'Logg ut',
    signOutDesc: 'Er du sikker på at du vil logge ut?', signOutTitle: 'Logg ut',
    statistics: 'Statistikk', support: 'Støtte', terms: 'Vilkår og betingelser',
    bankAccount: 'Bankkonto',
  },
  notifications: {
    title: 'Varsler', empty: 'Ingen varsler ennå',
    emptyDesc: 'Du varsles når bestillingene dine oppdateres', markAllRead: 'Merk alle som lest',
  },
  reviews: {
    title: 'Vurder tjeneste', subtitle: 'Hvordan var din opplevelse med {{name}}?',
    tapToRate: 'Trykk for å vurdere', rating1: 'Veldig dårlig', rating2: 'Dårlig',
    rating3: 'Greit', rating4: 'Bra', rating5: 'Utmerket!',
    whatStoundOut: 'Hva skilte seg ut?', addComment: 'Legg til kommentar',
    commentPlaceholder: 'Del detaljer om opplevelsen din...', ratingRequired: 'Vurdering påkrevd',
    pleaseRate: 'Velg stjerneklassifisering først', submit: 'Send vurdering',
    submitFailed: 'Kunne ikke sende vurdering', skipForNow: 'Hopp over nå',
    whatStoodOut: 'Hva skilte seg ut?',
  },
  disputes: {
    title: 'Åpne tvist', warningDesc: 'Beløpet vil bli fryst til tvisten er løst av teamet vårt.',
    selectReasonLabel: 'Årsak til tvist', descriptionLabel: 'Beskriv problemet',
    descriptionPlaceholder: 'Forklar problemet i detalj...', descriptionHint: 'Minst 20 tegn',
    evidence: 'Bevis', evidenceHint: 'Legg ved støttende bilder eller dokumenter',
    addEvidence: 'Legg til bevis', submit: 'Send tvist',
    submitted: 'Tvist sendt', submittedDesc: 'Teamet vårt vil gjennomgå tvisten din innen 24-48 timer.',
    submitFailed: 'Kunne ikke sende tvist', selectReason: 'Velg en årsak',
    descriptionTooShort: 'Skriv en lengre beskrivelse (minst 20 tegn)',
  },
  subscriptions: {
    title: 'Planer', monthly: 'Månedlig', yearly: 'Årlig', save30: 'Spar 30%',
    mostPopular: 'Mest populær', free: 'Gratis', month: 'mnd',
    tier_free: 'Gratis', tier_pro: 'Pro', tier_business: 'Business',
    billedAs: 'Fakturert årlig til {{total}} kr',
    subscribe: 'Abonner på {{tier}}', keepFree: 'Fortsett gratis',
    activated: 'Abonnement aktivert!', alreadyFree: 'Du er allerede på gratisplanen',
    failed: 'Abonnement mislyktes. Prøv igjen', cancelAnytime: 'Avbryt når som helst',
  },
  search: {
    results: 'resultater', noResults: 'Ingen resultater', tryDifferentKeyword: 'Prøv et annet søkeord',
    clearFilters: 'Fjern filtre', filters: 'Filtre', sortBy: 'Sorter etter',
    sort_distance: 'Nærmest', sort_rating: 'Høyest vurdert', sort_price: 'Pris',
    minRating: 'Minste vurdering', radius: 'Søkeradius', applyFilters: 'Bruk',
    resetFilters: 'Tilbakestill',
  },
  a11y: {
    loading: 'Laster',
  },
}

const EXTRA_SV = {
  tabs:          { home: 'Hem', orders: 'Beställningar', messages: 'Meddelanden', profile: 'Profil' },
  auth: {
    addDocument: 'Lägg till dokument', businessNamePlaceholder: 'Ditt företags eller organisations namn',
    companyDesc: 'Ett företag eller en organisation med ett team av leverantörer',
    createAccount: 'Skapa konto', getStarted: 'Kom igång', goToHome: 'Gå till startsidan',
    individualDesc: 'Jobba självständigt och erbjuda tjänster personligen',
    kycHint1: 'En tydlig bild av ditt nationella ID eller pass',
    kycHint2: 'För företag: bolagsregistrering eller näringstillstånd',
    kycHint3: 'Bilden måste vara tydlig och inte beskuren',
    kycPendingTitle: 'Under granskning', namePlaceholder: 'Fullständigt namn',
    passwordHint: 'Måste vara minst 8 tecken', phoneHint: 'Exempel: +46701234567',
    providerTypeSubtitle: 'Välj din kontotyp som tjänsteleverantör',
    providerTypeTitle: 'Kontotyp',
    resendIn: 'Skicka igen om {{seconds}}s', resendOtp: 'Skicka igen',
    sendOtp: 'Skicka verifieringskod', submitKyc: 'Skicka in dokument',
    tagline: 'Pålitliga tjänster nära till hands', verify: 'Verifiera',
  },
  chat: {
    attachImage: 'Bifoga bild', choosePhoto: 'Välj från bibliotek', title: 'Konversation',
    noConversations: 'Inga konversationer ännu',
    noConversationsDesc: 'Konversationer startar efter att du godkänt en offert',
    startConversation: 'Starta konversation med leverantör', takePhoto: 'Ta foto',
  },
  common: { all: 'Alla', there: 'där' },
  errors: {
    insufficientBalance: 'Otillräckligt saldo', invalidAmount: 'Ogiltigt belopp',
    invalidDuration: 'Ogiltig varaktighet', invalidEmail: 'Ogiltig e-post',
    invalidPhone: 'Ogiltigt telefonnummer', invalidPrice: 'Ogiltigt pris',
    kycRequired: 'Ladda upp minst ett dokument',
    minPayout: 'Minsta utbetalning är 10 enheter', nameTooShort: 'Namnet är för kort',
    passwordTooShort: 'Lösenordet är för kort',
    uploadFailed: 'Filuppladdning misslyckades, försök igen',
    unauthenticated: 'Du måste vara inloggad', permissionDenied: 'Du har inte behörighet för den här åtgärden',
    notFound: 'Objektet hittades inte', rateLimitExceeded: 'För många förfrågningar, försök igen om en stund',
  },
  home: {
    backHome: 'Tillbaka till startsidan', quickActions: 'Snabbåtgärder',
    tryExpandingRadius: 'Försök att utöka sökradien', welcome: 'Välkommen',
  },
  onboarding: {
    skip: 'Hoppa över',
    slide1_title: 'Hitta experter i närheten',
    slide1_sub: 'Tusentals professionella leverantörer i ditt område',
    slide2_title: 'Boka med förtroende',
    slide2_sub: 'Riktiga recensioner och transparenta priser innan bokning',
    slide3_title: 'Betala säkert',
    slide3_sub: 'Dina pengar hålls inne tills tjänsten bekräftats som slutförd',
  },
  orders: {
    addPhoto: 'Lägg till foto', addressHint: 'Stadsdel, gata, byggnadsnummer',
    addressLabel: 'Adress', addressPlaceholder: 'Ange din fullständiga adress',
    confirmDoneDesc: 'När det bekräftats frigörs beloppet till leverantören',
    createdAt: 'Skapad', describeStep: 'Beskriv problemet',
    describeStepSub: 'Ju mer detaljerad beskrivningen är, desto bättre offerter får du',
    details: 'Beställningsinformation',
    locationRequired: 'Aktivera platstjänster', locationStep: 'Din plats',
    locationStepSub: 'Leverantören använder denna adress för att nå dig',
    noOrdersDesc: 'Börja med att skapa din första beställning',
    photos: 'Foton', photosCount: 'foton', price: 'Pris',
    quoteAccepted: 'Offert godkänd', quoteExpired: 'Offert utgången',
    quoteRejected: 'Offert avvisad', quoteSentSuccess: 'Din offert skickades',
    quotes: 'Offerter', rejectQuoteConfirm: 'Är du säker på att du vill avvisa denna offert?',
    scheduleLaterDesc: 'Ange en specifik tid',
    scheduleNowDesc: 'Leverantören kontaktar dig omedelbart',
    scheduleStep: 'Schemalägg', scheduleStepSub: 'Vill du ha tjänsten nu eller vid en specifik tidpunkt?',
    scheduledAt: 'Schemalagd tid', submitOrder: 'Skicka beställning', summary: 'Beställningssammanfattning',
    waitingForQuotes: 'Väntar på offerter från leverantörer',
  },
  payment: {
    cancelDesc: 'Vill du avbryta betalningen? Din beställning förblir bekräftad.',
    cancelPayment: 'Avbryt betalning', cancelTitle: 'Avbryt betalning',
    cashHint: 'Betala kontant till leverantören vid tjänstens slutförande',
    continuePaying: 'Fortsätt betala',
    escrowStep1: 'Din betalning hålls säkert tills tjänsten är slutförd',
    escrowStep2: 'Efter din bekräftelse överförs beloppet till leverantören',
    escrowStep3: 'Vid tvist behålls beloppet för dig',
    escrowTitle: 'Hur fungerar skyddet?',
    failedDesc: 'Betalningen slutfördes inte. Du kan försöka igen.',
    invalidSession: 'Ogiltig betalningssession', loadError: 'Det gick inte att ladda betalningssidan',
    loading: 'Laddar betalningssidan...', mada: 'Mada',
    securePayment: 'Säker betalning', serviceAmount: 'Tjänstebelopp',
    successDesc: 'Dina pengar hålls säkert tills tjänsten bekräftats som slutförd',
    terms: 'Genom att fortsätta godkänner du villkoren',
    trackOrder: 'Spåra beställning', tryAgain: 'Försök igen',
    vat: 'Moms', status_held: 'Hålls inne', status_captured: 'Slutförd', status_refunded: 'Återbetald',
  },
  provider: {
    about: 'Om leverantören', bankAccountDesc: 'Lägg till konto för att ta emot betalningar',
    bookNow: 'Boka nu', dashboard: 'Instrumentpanel', dayOff: 'Ledig dag',
    history: 'Historik', howPayoutWorks: 'Hur fungerar utbetalningar?',
    leaveBlankForFull: 'Lämna tomt för att ta ut hela saldot', newRequests: 'Nya förfrågningar',
    noOrdersDesc: 'Kundförfrågningar från närheten visas här',
    noReviews: 'Inga recensioner ännu', ongoing: 'Pågående',
    payoutAmountPlaceholder: 'Önskat belopp',
    payoutInfo1: 'Belopp överförs 24 timmar efter att beställningen stängs',
    payoutInfo2: 'Minsta utbetalning är 10 enheter',
    payoutInfo3: 'Överföringen tar 1–3 arbetsdagar',
    payoutRequested: 'Utbetalningsbegäran skickad', processing: 'Behandlar',
    provider: 'Leverantör', quoteNotePlaceholder: 'Ytterligare anteckningar till kunden...',
    verified: 'Verifierad', workingHours: 'Arbetstider',
  },
  profile: {
    account: 'Konto', anonymous: 'Användare', changePassword: 'Ändra lösenord',
    contactUs: 'Kontakta oss', editProfile: 'Redigera profil', faq: 'Vanliga frågor',
    language: 'Språk', languageHint: 'Byta mellan AR och EN startar om appen',
    myServices: 'Mina tjänster', notifications: 'Aviseringar', privacy: 'Integritetspolicy',
    providerTools: 'Leverantörsverktyg', rateApp: 'Betygsätt appen', signOut: 'Logga ut',
    signOutDesc: 'Är du säker på att du vill logga ut?', signOutTitle: 'Logga ut',
    statistics: 'Statistik', support: 'Support', terms: 'Villkor',
    bankAccount: 'Bankkonto',
  },
  notifications: {
    title: 'Aviseringar', empty: 'Inga aviseringar ännu',
    emptyDesc: 'Du meddelas när dina beställningar uppdateras', markAllRead: 'Markera alla som lästa',
  },
  reviews: {
    title: 'Betygsätt tjänst', subtitle: 'Hur var din upplevelse med {{name}}?',
    tapToRate: 'Tryck för att betygsätta', rating1: 'Mycket dåligt', rating2: 'Dåligt',
    rating3: 'Okej', rating4: 'Bra', rating5: 'Utmärkt!',
    whatStoodOut: 'Vad utmärkte sig?', addComment: 'Lägg till kommentar',
    commentPlaceholder: 'Dela detaljer om din upplevelse...', ratingRequired: 'Betyg krävs',
    pleaseRate: 'Välj ett stjärnbetyg först', submit: 'Skicka recension',
    submitFailed: 'Kunde inte skicka recension', skipForNow: 'Hoppa över nu',
  },
  disputes: {
    title: 'Öppna tvist', warningDesc: 'Beloppet fryses tills tvisten löses av vårt team.',
    selectReasonLabel: 'Anledning till tvist', descriptionLabel: 'Beskriv problemet',
    descriptionPlaceholder: 'Förklara problemet i detalj...', descriptionHint: 'Minst 20 tecken',
    evidence: 'Bevis', evidenceHint: 'Bifoga stödjande bilder eller dokument',
    addEvidence: 'Lägg till bevis', submit: 'Skicka tvist',
    submitted: 'Tvist skickad', submittedDesc: 'Vårt team granskar din tvist inom 24–48 timmar.',
    submitFailed: 'Kunde inte skicka tvist', selectReason: 'Välj en anledning',
    descriptionTooShort: 'Skriv en längre beskrivning (minst 20 tecken)',
  },
  subscriptions: {
    title: 'Planer', monthly: 'Månadsvis', yearly: 'Årsvis', save30: 'Spara 30%',
    mostPopular: 'Mest populär', free: 'Gratis', month: 'mån',
    tier_free: 'Gratis', tier_pro: 'Pro', tier_business: 'Business',
    billedAs: 'Faktureras årligen till {{total}} kr',
    subscribe: 'Prenumerera på {{tier}}', keepFree: 'Fortsätt gratis',
    activated: 'Prenumeration aktiverad!', alreadyFree: 'Du är redan på gratisplanen',
    failed: 'Prenumeration misslyckades. Försök igen', cancelAnytime: 'Avsluta när som helst',
  },
  search: {
    results: 'resultat', noResults: 'Inga resultat', tryDifferentKeyword: 'Prova ett annat sökord',
    clearFilters: 'Rensa filter', filters: 'Filter', sortBy: 'Sortera efter',
    sort_distance: 'Närmast', sort_rating: 'Högst betyg', sort_price: 'Pris',
    minRating: 'Minsta betyg', radius: 'Sökradie', applyFilters: 'Tillämpa',
    resetFilters: 'Återställ',
  },
  a11y: {
    loading: 'Laddar',
  },
}

const savedLang = (storage.getString('lang') ?? 'ar') as SupportedLocale

// allowRTL(true) once — tells RN that RTL is supported.
// forceRTL is only changed inside changeLanguage() when direction flips.
// This avoids unnecessary layout recalculations on every module load.
I18nManager.allowRTL(true)

// Deep merge: combine base translations with EXTRA_ namespaces
// Uses spread per-namespace to avoid shallow-overwrite problem
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  extra: Partial<Record<string, Record<string, string>>>,
): T {
  const result = { ...base } as Record<string, unknown>
  for (const [ns, vals] of Object.entries(extra)) {
    result[ns] = { ...(result[ns] as Record<string, string> ?? {}), ...vals }
  }
  return result as T
}

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: deepMerge(ar as unknown as Record<string, unknown>, EXTRA_AR) },
    en: { translation: deepMerge(en as unknown as Record<string, unknown>, EXTRA_EN) },
    no: { translation: deepMerge(no as unknown as Record<string, unknown>, EXTRA_NO) },
    sv: { translation: deepMerge(sv as unknown as Record<string, unknown>, EXTRA_SV) },
  },
  lng:          savedLang,
  fallbackLng:  'en',
  interpolation: { escapeValue: false },
})

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE SWITCHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Switch app language.
 *
 * - ar  ↔  en/no/sv  → requires app reload (RTL ↔ LTR switch)
 * - en  ↔  no  ↔  sv → instant, no reload needed (all LTR)
 */
export async function changeLanguage(lang: SupportedLocale): Promise<void> {
  const goingRTL = isRtlLocale(lang)
  const nowRTL   = I18nManager.isRTL   // read live device state (survives reload)

  // Persist first — survives the upcoming reload if direction flips
  storage.set('lang', lang)

  if (goingRTL !== nowRTL) {
    // Direction flip: must forceRTL + full reload so native layout engine re-applies.
    // Updates.reloadAsync() does NOT return — the app restarts immediately.
    I18nManager.allowRTL(true)
    I18nManager.forceRTL(goingRTL)
    await Updates.reloadAsync()
  } else {
    // Same direction (EN ↔ NO ↔ SV): instant, zero-reload swap
    await i18n.changeLanguage(lang)
  }
}

export type { SupportedLocale }
export default i18n

