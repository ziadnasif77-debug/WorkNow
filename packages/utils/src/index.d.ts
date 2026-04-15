import type { GeoPoint, OrderStatus, Currency, SupportedLocale } from '@workfix/types';
/** Encode a GeoPoint to a geohash string (precision 6 ≈ 1.2km accuracy) */
export declare function encodeGeohash(point: GeoPoint, precision?: number): string;
/** Get neighbor geohashes for a given hash (used in geo queries) */
export declare function getGeohashRange(geohash: string): {
    lower: string;
    upper: string;
};
/** Calculate distance between two GeoPoints in kilometers (Haversine formula) */
export declare function distanceKm(a: GeoPoint, b: GeoPoint): number;
/** Format a price for display — handles RTL (Arabic) and LTR (NO/SV/EN) */
export declare function formatPrice(amount: number, currency?: Currency, lang?: SupportedLocale): string;
/** Calculate commission amount from gross price */
export declare function calcCommission(grossAmount: number, commissionRate: number): number;
/** Calculate net amount for provider after commission */
export declare function calcNetAmount(grossAmount: number, commissionRate: number): number;
/** Format a Timestamp or Date for display */
export declare function formatDate(date: Date | {
    toDate(): Date;
}, lang?: SupportedLocale, style?: 'date' | 'datetime' | 'time' | 'relative'): string;
/**
 * Valid order status transitions.
 * Key = current status, Value = allowed next statuses
 */
export declare const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]>;
/** Check if a status transition is valid */
export declare function isValidTransition(from: OrderStatus, to: OrderStatus): boolean;
/** Get human-readable order status label */
export declare function getOrderStatusLabel(status: OrderStatus, lang?: 'ar' | 'en'): string;
export declare function isValidPhone(phone: string): boolean;
export declare function isValidEmail(email: string): boolean;
export declare function isValidRating(rating: number): boolean;
/** Sanitize user-supplied text (basic XSS prevention) */
export declare function sanitizeText(input: string, maxLength?: number): string;
/** Generate a Firestore-style push ID (client-side, time-ordered) */
export declare function generateId(): string;
/**
 * Truncate a string to maxLength, appending ellipsis if needed.
 */
export declare function truncate(str: string, maxLength: number, ellipsis?: string): string;
/**
 * Convert a string to a URL-safe slug.
 * e.g. "Hello World!" → "hello-world"
 */
export declare function slugify(str: string): string;
/**
 * Deep equality check for plain objects/arrays.
 */
export declare function deepEqual(a: unknown, b: unknown): boolean;
/**
 * Format a date relative to now (e.g. "منذ 3 دقائق", "2 minutes ago").
 */
export declare function formatRelativeTime(date: Date, locale?: 'ar' | 'en'): string;
//# sourceMappingURL=index.d.ts.map