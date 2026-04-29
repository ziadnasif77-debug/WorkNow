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

// Reanimated mock (prevents "Reanimated not found" errors in tests)
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
)

// react-native-maps mock (native module not available in jest)
jest.mock('react-native-maps', () => {
  const React = require('react')
  const { View } = require('react-native')
  const MockMapView = (props) => React.createElement(View, props)
  const MockMarker = (props) => React.createElement(View, props)
  MockMapView.Animated = MockMapView
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: null,
  }
})

// expo-image mock
jest.mock('expo-image', () => {
  const React = require('react')
  const { Image } = require('react-native')
  return { Image: (props) => React.createElement(Image, props) }
})

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

// @react-native-firebase/analytics mock
jest.mock('@react-native-firebase/analytics', () => () => ({
  logEvent:            jest.fn(() => Promise.resolve()),
  setUserId:           jest.fn(() => Promise.resolve()),
  setUserProperties:   jest.fn(() => Promise.resolve()),
  logScreenView:       jest.fn(() => Promise.resolve()),
  logPurchase:         jest.fn(() => Promise.resolve()),
  logLogin:            jest.fn(() => Promise.resolve()),
  logSignUp:           jest.fn(() => Promise.resolve()),
  resetAnalyticsData:  jest.fn(() => Promise.resolve()),
}))

// @react-native-firebase/crashlytics mock
jest.mock('@react-native-firebase/crashlytics', () => () => ({
  recordError:         jest.fn(),
  log:                 jest.fn(),
  setUserId:           jest.fn(() => Promise.resolve()),
  setAttribute:        jest.fn(() => Promise.resolve()),
  crash:               jest.fn(),
  checkForUnsentReports: jest.fn(() => Promise.resolve()),
}))

// @react-native-firebase/app mock
jest.mock('@react-native-firebase/app', () => ({
  default: { apps: [] },
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
