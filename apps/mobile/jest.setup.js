// ─────────────────────────────────────────────────────────────────────────────
// Jest global setup — mocks that apply to every test file
// ─────────────────────────────────────────────────────────────────────────────

// ── TextEncoder / TextDecoder polyfill ────────────────────────────────────────
// Required by expo-notifications (and its deps) which use the WHATWG Encoding
// API. Jest's jsdom environment does not always include these globals.
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// ── setImmediate polyfill ─────────────────────────────────────────────────────
// jsdom doesn't include setImmediate; React Native's InteractionManager uses it
// (called from Animated.loop via createInteractionHandle).
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => global.setTimeout(fn, 0, ...args)
  global.clearImmediate = (id) => global.clearTimeout(id)
}

// Reanimated mock (prevents "Reanimated not found" errors in tests)
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
)

// react-native-safe-area-context mock (useSafeAreaInsets requires SafeAreaProvider in tests)
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return {
    SafeAreaProvider:   ({ children }) => children,
    SafeAreaView:       ({ children }) => children,
    useSafeAreaInsets:  () => insets,
    useSafeAreaFrame:   () => ({ x: 0, y: 0, width: 390, height: 844 }),
    SafeAreaInsetsContext: React.createContext(insets),
    initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
  }
})

// react-native-maps — components use View directly; no jest.mock needed

// expo-image mock
jest.mock('expo-image', () => {
  const React = require('react')
  const { Image } = require('react-native')
  return { Image: (props) => React.createElement(Image, props) }
})

// expo-location mock (native ExpoLocation module not available in jest)
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getForegroundPermissionsAsync:     jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync:           jest.fn(() => Promise.resolve({
    coords: { latitude: 24.7136, longitude: 46.6753, altitude: null, accuracy: 10, heading: null, speed: null },
    timestamp: Date.now(),
  })),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([{ city: 'Riyadh', region: 'Riyadh', isoCountryCode: 'SA' }])),
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
}))

// MMKV mock (native module not available in jest)
jest.mock('react-native-mmkv', () => {
  const store = new Map()
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set:    jest.fn((k, v) => store.set(k, v)),
      getString: jest.fn(k => store.get(k)),
      getBoolean: jest.fn(k => store.get(k)),
      delete: jest.fn(k => store.delete(k)),
    })),
  }
})

// expo-notifications mock (native module ExpoPushTokenManager not available in jest)
jest.mock('expo-notifications', () => ({
  getPermissionsAsync:       jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync:   jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync:     jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[mock]' })),
  getDevicePushTokenAsync:   jest.fn(() => Promise.resolve({ type: 'expo', data: 'mock-token' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  dismissAllNotificationsAsync: jest.fn(() => Promise.resolve()),
  getBadgeCountAsync:        jest.fn(() => Promise.resolve(0)),
  setBadgeCountAsync:        jest.fn(() => Promise.resolve(true)),
  addNotificationReceivedListener:         jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener:                    jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription:                jest.fn(),
  setNotificationHandler:                        jest.fn(),
  getLastNotificationResponseAsync:              jest.fn(() => Promise.resolve(null)),
  getPresentedNotificationsAsync:                jest.fn(() => Promise.resolve([])),
  dismissNotificationAsync:                      jest.fn(() => Promise.resolve()),
  setNotificationCategoryAsync:                  jest.fn(() => Promise.resolve()),
  getNotificationCategoriesAsync:                jest.fn(() => Promise.resolve([])),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3 },
}))

// expo-store-review mock (native ExpoStoreReview module not available in jest)
jest.mock('expo-store-review', () => ({
  isAvailableAsync:    jest.fn(() => Promise.resolve(false)),
  requestReview:       jest.fn(() => Promise.resolve()),
  storeUrl:            jest.fn(() => null),
  hasAction:           jest.fn(() => Promise.resolve(false)),
}))

// expo-updates mock
jest.mock('expo-updates', () => ({
  reloadAsync:         jest.fn(() => Promise.resolve()),
  checkForUpdateAsync: jest.fn(() => Promise.resolve({ isAvailable: false })),
}))

// expo-font mock
jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(() => Promise.resolve()),
}))

// expo-router mock
jest.mock('expo-router', () => ({
  useRouter:             jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
  useLocalSearchParams:  jest.fn(() => ({})),
  useSegments:           jest.fn(() => []),
  usePathname:           jest.fn(() => '/'),
  Link:                  ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: jest.fn(() => null),
  },
  Tabs: {
    Screen: jest.fn(() => null),
  },
}))

// Firebase mock (basic, override per-test as needed)
jest.mock('@workfix/config', () => ({
  getFirebaseConfig: jest.fn(() => ({
    apiKey: 'test-key', authDomain: 'test.firebaseapp.com',
    projectId: 'test-project', storageBucket: 'test.appspot.com',
    messagingSenderId: '123', appId: '1:123:web:abc',
  })),
  FEATURE_FLAGS: {
    SUBSCRIPTIONS_ENABLED: 'subscriptions_enabled',
    DISPUTES_ENABLED:      'disputes_enabled',
    CASH_PAYMENT_ENABLED:  'cash_payment_enabled',
    BOOST_ENABLED:         'boost_enabled',
    AGENCY_MODEL_ENABLED:  'agency_model_enabled',
    NORWAY_MARKET_ENABLED: 'norway_market_enabled',
    SWEDEN_MARKET_ENABLED: 'sweden_market_enabled',
  },
  DEFAULT_COMMISSION_RATE:   0.12,
  QUOTE_EXPIRY_HOURS:        24,
  ESCROW_AUTO_RELEASE_HOURS: 48,
  GEO_PRECISION:             6,
  PAGE_SIZE:                 20,
}))

jest.mock('./src/lib/firebase', () => ({
  firebaseAuth:      { currentUser: null },
  firestore:         {},
  firebaseStorage:   {},
  firebaseFunctions: {},
  firebaseApp:       {},
}))

// @react-native-firebase/analytics mock (virtual: package not in node_modules)
jest.mock('@react-native-firebase/analytics', () => () => ({
  logEvent:            jest.fn(() => Promise.resolve()),
  setUserId:           jest.fn(() => Promise.resolve()),
  setUserProperties:   jest.fn(() => Promise.resolve()),
  logScreenView:       jest.fn(() => Promise.resolve()),
  logPurchase:         jest.fn(() => Promise.resolve()),
  logLogin:            jest.fn(() => Promise.resolve()),
  logSignUp:           jest.fn(() => Promise.resolve()),
  resetAnalyticsData:  jest.fn(() => Promise.resolve()),
}), { virtual: true })

// @react-native-firebase/crashlytics mock (virtual: package not in node_modules)
jest.mock('@react-native-firebase/crashlytics', () => () => ({
  recordError:         jest.fn(),
  log:                 jest.fn(),
  setUserId:           jest.fn(() => Promise.resolve()),
  setAttribute:        jest.fn(() => Promise.resolve()),
  crash:               jest.fn(),
  checkForUnsentReports: jest.fn(() => Promise.resolve()),
}), { virtual: true })

// @react-native-firebase/app mock (virtual: package not in node_modules)
jest.mock('@react-native-firebase/app', () => ({
  default: { apps: [] },
}), { virtual: true })

// Analytics mock (lib/analytics wraps firebase analytics)
jest.mock('./src/lib/analytics', () => ({
  Analytics: {
    signUpStart:          jest.fn(),
    signUpComplete:       jest.fn(),
    login:                jest.fn(),
    kycSubmitted:         jest.fn(),
    kycApproved:          jest.fn(),
    providerSearch:       jest.fn(),
    providerProfileView:  jest.fn(),
    categorySelected:     jest.fn(),
    orderStarted:         jest.fn(),
    orderSubmitted:       jest.fn(),
    quoteReceived:        jest.fn(),
    quoteAccepted:        jest.fn(),
    paymentStarted:       jest.fn(),
    paymentComplete:      jest.fn(() => Promise.resolve()),
    orderCompleted:       jest.fn(),
    orderCancelled:       jest.fn(),
    chatMessageSent:      jest.fn(),
    reviewSubmitted:      jest.fn(),
    disputeOpened:        jest.fn(),
    subscriptionStarted:  jest.fn(),
    subscriptionUpgraded: jest.fn(),
    notificationTapped:   jest.fn(),
    setUserProperties:    jest.fn(() => Promise.resolve()),
  },
  initAnalytics: jest.fn(),
}))

// @react-native-async-storage/async-storage mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:     jest.fn(() => Promise.resolve(null)),
  setItem:     jest.fn(() => Promise.resolve()),
  removeItem:  jest.fn(() => Promise.resolve()),
  clear:       jest.fn(() => Promise.resolve()),
  getAllKeys:   jest.fn(() => Promise.resolve([])),
  multiGet:    jest.fn(() => Promise.resolve([])),
  multiSet:    jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

// react-native-webview mock
jest.mock('react-native-webview', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props) => React.createElement(View, { testID: 'webview', ...props }),
    WebView: (props) => React.createElement(View, { testID: 'webview', ...props }),
  }
})

// expo-document-picker mock
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  DocumentPickerAsset: {},
}))

// @react-native-community/netinfo mock (package uses default import)
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch:            jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(() => jest.fn()),
    configure:        jest.fn(),
  },
  useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}))

// @react-native-community/datetimepicker mock
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { __esModule: true, default: (props) => React.createElement(View, props) }
})

// lib/monitoring mock (Sentry/Crashlytics stub — native modules not available in jest)
jest.mock('./src/lib/monitoring', () => ({
  captureError:    jest.fn(),
  captureMessage:  jest.fn(),
  setUser:         jest.fn(),
  addBreadcrumb:   jest.fn(),
  initMonitoring:  jest.fn(),
}))

// ── Fetch polyfill (firebase/functions uses fetch at module load time) ─────────
// jsdom provides fetch in newer versions, but add a fallback for pnpm/node compat
if (typeof fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok:   true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  )
}

// ── firebase/functions global mock (prevents module-level fetch call) ──────────
// This overrides any store that imports httpsCallable from firebase/functions
jest.mock('firebase/functions', () => ({
  getFunctions:  jest.fn(),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: jest.fn(),
}))

// ── firebase/firestore global mock ────────────────────────────────────────────
jest.mock('firebase/firestore', () => ({
  getFirestore:                jest.fn(),
  initializeFirestore:         jest.fn(),
  enableIndexedDbPersistence:  jest.fn(() => Promise.resolve()),
  collection:                  jest.fn(() => 'col-ref'),
  query:                       jest.fn(() => 'query-ref'),
  where:                       jest.fn(),
  orderBy:                     jest.fn(),
  limit:                       jest.fn(),
  doc:                         jest.fn(() => 'doc-ref'),
  onSnapshot:                  jest.fn(() => jest.fn()),
  getDocs:                     jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc:                      jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc:                      jest.fn(() => Promise.resolve()),
  updateDoc:                   jest.fn(() => Promise.resolve()),
  deleteDoc:                   jest.fn(() => Promise.resolve()),
  addDoc:                      jest.fn(() => Promise.resolve({ id: 'mock-id' })),
  writeBatch:                  jest.fn(() => ({
    set:    jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  })),
  serverTimestamp:             jest.fn(() => new Date()),
  increment:                   jest.fn(n => n),
  arrayUnion:                  jest.fn((...args) => args),
  arrayRemove:                 jest.fn((...args) => args),
  connectFirestoreEmulator:    jest.fn(),
  persistentLocalCache:        jest.fn(),
  persistentMultipleTabManager:jest.fn(),
  memoryLocalCache:            jest.fn(),
  CACHE_SIZE_UNLIMITED:        -1,
}))

// ── firebase/storage global mock ──────────────────────────────────────────────
jest.mock('firebase/storage', () => ({
  getStorage:           jest.fn(),
  ref:                  jest.fn(),
  uploadBytes:          jest.fn(() => Promise.resolve({ ref: 'storage-ref' })),
  uploadBytesResumable: jest.fn(() => ({
    on:    jest.fn(),
    catch: jest.fn(),
  })),
  getDownloadURL:       jest.fn(() => Promise.resolve('https://storage.example.com/file')),
  deleteObject:         jest.fn(() => Promise.resolve()),
  connectStorageEmulator: jest.fn(),
}))

// ── firebase/auth global mock ─────────────────────────────────────────────────
jest.mock('firebase/auth', () => ({
  getAuth:                        jest.fn(),
  initializeAuth:                 jest.fn(),
  signInWithEmailAndPassword:     jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPhoneNumber:          jest.fn(),
  signOut:                        jest.fn(() => Promise.resolve()),
  onAuthStateChanged:             jest.fn(() => jest.fn()),
  GoogleAuthProvider:             class {},
  signInWithCredential:           jest.fn(),
  updateProfile:                  jest.fn(() => Promise.resolve()),
  updatePassword:                 jest.fn(() => Promise.resolve()),
  reauthenticateWithCredential:   jest.fn(() => Promise.resolve()),
  EmailAuthProvider:              { credential: jest.fn() },
  connectAuthEmulator:            jest.fn(),
  getReactNativePersistence:      jest.fn(),
  indexedDBLocalPersistence:      {},
  inMemoryPersistence:            {},
  browserLocalPersistence:        {},
  sendPasswordResetEmail:         jest.fn(() => Promise.resolve()),
}))
