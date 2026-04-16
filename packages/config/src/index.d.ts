export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
}
/**
 * Returns Firebase config.
 * Reads env vars first; falls back to the hardcoded project config.
 */
export declare function getFirebaseConfig(): FirebaseConfig;
/** Always true — the fallback config ensures Firebase is always available. */
export declare function isFirebaseConfigured(): boolean;
/** Feature flag keys (used with Firebase Remote Config) */
export declare const FEATURE_FLAGS: {
    readonly SUBSCRIPTIONS_ENABLED: "subscriptions_enabled";
    readonly BOOST_ENABLED: "boost_enabled";
    readonly DISPUTES_ENABLED: "disputes_enabled";
    readonly CASH_PAYMENT_ENABLED: "cash_payment_enabled";
    readonly AGENCY_MODEL_ENABLED: "agency_model_enabled";
    readonly NORWAY_MARKET_ENABLED: "norway_market_enabled";
    readonly SWEDEN_MARKET_ENABLED: "sweden_market_enabled";
};
export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];
/** Default commission rate (12%) — override via Remote Config */
export declare const DEFAULT_COMMISSION_RATE = 0.12;
/** Quote expiry duration in hours */
export declare const QUOTE_EXPIRY_HOURS = 24;
/** Escrow auto-release after provider completes (hours) */
export declare const ESCROW_AUTO_RELEASE_HOURS = 48;
/** Geohash precision for provider search (6 ≈ 1.2km) */
export declare const GEO_PRECISION = 6;
/** Default search radius in km */
export declare const DEFAULT_SEARCH_RADIUS_KM = 20;
/** Pagination defaults */
export declare const PAGE_SIZE = 20;
//# sourceMappingURL=index.d.ts.map