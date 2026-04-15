"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// @workfix/utils — Shared utility functions
// ─────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_TRANSITIONS = void 0;
exports.encodeGeohash = encodeGeohash;
exports.getGeohashRange = getGeohashRange;
exports.distanceKm = distanceKm;
exports.formatPrice = formatPrice;
exports.calcCommission = calcCommission;
exports.calcNetAmount = calcNetAmount;
exports.formatDate = formatDate;
exports.isValidTransition = isValidTransition;
exports.getOrderStatusLabel = getOrderStatusLabel;
exports.isValidPhone = isValidPhone;
exports.isValidEmail = isValidEmail;
exports.isValidRating = isValidRating;
exports.sanitizeText = sanitizeText;
exports.generateId = generateId;
exports.truncate = truncate;
exports.slugify = slugify;
exports.deepEqual = deepEqual;
exports.formatRelativeTime = formatRelativeTime;
const ngeohash_1 = __importDefault(require("ngeohash"));
// ─────────────────────────────────────────────────────────────────────────────
// GEO UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
/** Encode a GeoPoint to a geohash string (precision 6 ≈ 1.2km accuracy) */
function encodeGeohash(point, precision = 6) {
    return ngeohash_1.default.encode(point.latitude, point.longitude, precision);
}
/** Get neighbor geohashes for a given hash (used in geo queries) */
function getGeohashRange(geohash) {
    const neighbors = ngeohash_1.default.neighbors(geohash);
    const allHashes = [geohash, ...Object.values(neighbors)].sort();
    return {
        lower: allHashes[0] ?? geohash,
        upper: allHashes[allHashes.length - 1] ?? geohash,
    };
}
/** Calculate distance between two GeoPoints in kilometers (Haversine formula) */
function distanceKm(a, b) {
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const chord = sinLat * sinLat +
        Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
    return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}
function toRad(deg) {
    return (deg * Math.PI) / 180;
}
// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY & PRICE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS = {
    // MENA
    SAR: 'ر.س',
    AED: 'د.إ',
    KWD: 'د.ك',
    BHD: 'د.ب',
    OMR: 'ر.ع',
    QAR: 'ر.ق',
    EGP: 'ج.م',
    // Scandinavia
    NOK: 'kr',
    SEK: 'kr',
};
/** Format a price for display — handles RTL (Arabic) and LTR (NO/SV/EN) */
function formatPrice(amount, currency = 'SAR', lang = 'ar') {
    const symbol = CURRENCY_SYMBOLS[currency];
    const localeMap = {
        ar: 'ar-SA',
        en: 'en-US',
        no: 'nb-NO',
        sv: 'sv-SE',
    };
    const formatted = amount.toLocaleString(localeMap[lang], {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
    // Scandinavian convention: "150 kr"  (symbol after)
    // Arabic convention:       "150 ر.س" (symbol after, RTL handles direction)
    // English convention:      "ر.س 150" (symbol before, kept for en)
    return lang === 'en'
        ? `${symbol} ${formatted}`
        : `${formatted} ${symbol}`;
}
/** Calculate commission amount from gross price */
function calcCommission(grossAmount, commissionRate) {
    return Math.round(grossAmount * commissionRate * 100) / 100;
}
/** Calculate net amount for provider after commission */
function calcNetAmount(grossAmount, commissionRate) {
    return Math.round((grossAmount - calcCommission(grossAmount, commissionRate)) * 100) / 100;
}
// ─────────────────────────────────────────────────────────────────────────────
// DATE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────
/** Format a Timestamp or Date for display */
function formatDate(date, lang = 'ar', style = 'datetime') {
    const d = date instanceof Date ? date : date.toDate();
    const localeMap = {
        ar: 'ar-SA',
        en: 'en-US',
        no: 'nb-NO',
        sv: 'sv-SE',
    };
    const locale = localeMap[lang];
    if (style === 'relative')
        return formatRelative(d, locale);
    const options = style === 'time'
        ? { hour: '2-digit', minute: '2-digit' }
        : style === 'date'
            ? { day: 'numeric', month: 'long', year: 'numeric' }
            : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat(locale, options).format(d);
}
function formatRelative(date, locale) {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffMins < 1)
        return rtf.format(0, 'seconds');
    if (diffMins < 60)
        return rtf.format(-diffMins, 'minutes');
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
        return rtf.format(-diffHours, 'hours');
    return rtf.format(-Math.floor(diffHours / 24), 'days');
}
// ─────────────────────────────────────────────────────────────────────────────
// ORDER STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Valid order status transitions.
 * Key = current status, Value = allowed next statuses
 */
exports.ORDER_TRANSITIONS = {
    pending: ['quoted', 'cancelled'],
    quoted: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled', 'disputed'],
    in_progress: ['completed', 'disputed'],
    completed: ['closed', 'disputed'],
    closed: [],
    cancelled: [],
    disputed: ['closed', 'cancelled'],
};
/** Check if a status transition is valid */
function isValidTransition(from, to) {
    return exports.ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
/** Get human-readable order status label */
function getOrderStatusLabel(status, lang = 'ar') {
    const labels = {
        pending: { ar: 'بانتظار العروض', en: 'Pending' },
        quoted: { ar: 'تلقّى عرض سعر', en: 'Quoted' },
        confirmed: { ar: 'مؤكَّد', en: 'Confirmed' },
        in_progress: { ar: 'جارٍ التنفيذ', en: 'In Progress' },
        completed: { ar: 'منتهٍ', en: 'Completed' },
        closed: { ar: 'مغلق', en: 'Closed' },
        cancelled: { ar: 'ملغى', en: 'Cancelled' },
        disputed: { ar: 'نزاع مفتوح', en: 'Disputed' },
    };
    return labels[status][lang];
}
// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function isValidPhone(phone) {
    // Supports: +966xxxxxxxxx, 05xxxxxxxx, international formats
    return /^\+?[0-9]{9,15}$/.test(phone.replace(/[\s\-()]/g, ''));
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidRating(rating) {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}
/** Sanitize user-supplied text (basic XSS prevention) */
function sanitizeText(input, maxLength = 1000) {
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>]/g, '');
}
// ─────────────────────────────────────────────────────────────────────────────
// ID GENERATORS
// ─────────────────────────────────────────────────────────────────────────────
/** Generate a Firestore-style push ID (client-side, time-ordered) */
function generateId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const timestamp = Date.now().toString(36);
    let random = '';
    for (let i = 0; i < 12; i++) {
        random += chars[Math.floor(Math.random() * chars.length)];
    }
    return timestamp + random;
}
// ─────────────────────────────────────────────────────────────────────────────
// String / general utilities
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Truncate a string to maxLength, appending ellipsis if needed.
 */
function truncate(str, maxLength, ellipsis = '…') {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}
/**
 * Convert a string to a URL-safe slug.
 * e.g. "Hello World!" → "hello-world"
 */
function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * Deep equality check for plain objects/arrays.
 */
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b)
        return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
        return false;
    return keysA.every(k => deepEqual(a[k], b[k]));
}
/**
 * Format a date relative to now (e.g. "منذ 3 دقائق", "2 minutes ago").
 */
function formatRelativeTime(date, locale = 'ar') {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (locale === 'ar') {
        if (mins < 1)
            return 'الآن';
        if (mins < 60)
            return `منذ ${mins} دقيقة`;
        if (hours < 24)
            return `منذ ${hours} ساعة`;
        if (days < 7)
            return `منذ ${days} يوم`;
        return date.toLocaleDateString('ar-SA');
    }
    else {
        if (mins < 1)
            return 'just now';
        if (mins < 60)
            return `${mins}m ago`;
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return date.toLocaleDateString('en-US');
    }
}
//# sourceMappingURL=index.js.map