// Fix for jest-expo setup.js which calls require('...NativeModules').default
// The real module uses module.exports (no .default), so we wrap it here.
const modules = {
  UIManager: {},
  AlertManager: { alertWithArgs: jest.fn() },
  AsyncLocalStorage: {
    multiGet: jest.fn((keys, cb) => process.nextTick(() => cb(null, []))),
    multiSet: jest.fn((entries, cb) => process.nextTick(() => cb(null))),
    multiRemove: jest.fn((keys, cb) => process.nextTick(() => cb(null))),
    multiMerge: jest.fn((entries, cb) => process.nextTick(() => cb(null))),
    clear: jest.fn(cb => process.nextTick(() => cb(null))),
    getAllKeys: jest.fn(cb => process.nextTick(() => cb(null, []))),
  },
  DeviceInfo: { getConstants: () => ({ Dimensions: { window: { width: 375, height: 812, scale: 2, fontScale: 1 }, screen: { width: 375, height: 812, scale: 2, fontScale: 1 } } }) },
  Networking: {
    sendRequest: jest.fn(), abortRequest: jest.fn(),
    addListener: jest.fn(), removeListeners: jest.fn(),
  },
  Timing: { createTimer: jest.fn(), deleteTimer: jest.fn() },
  SourceCode: { getConstants: () => ({ scriptURL: null, scriptURLs: null }) },
  PlatformConstants: {
    getConstants: () => ({
      forceTouchAvailable: false, interfaceIdiom: 'phone',
      isTesting: true, osVersion: '16.0', systemName: 'iOS',
    }),
  },
  StatusBarManager: {
    getConstants: () => ({ HEIGHT: 44 }),
    setStyle: jest.fn(), setHidden: jest.fn(), setNetworkActivityIndicatorVisible: jest.fn(),
    setBackgroundColor: jest.fn(), setTranslucent: jest.fn(),
  },
  BlobModule: {
    getConstants: () => ({ BLOB_URI_SCHEME: 'content', BLOB_URI_HOST: null }),
    addNetworkingHandler: jest.fn(), enableBlobSupport: jest.fn(),
    disableBlobSupport: jest.fn(), createFromParts: jest.fn(),
    sendBlob: jest.fn(), release: jest.fn(),
  },
  WebSocketModule: {
    connect: jest.fn(), send: jest.fn(), sendBinary: jest.fn(),
    ping: jest.fn(), close: jest.fn(),
    addListener: jest.fn(), removeListeners: jest.fn(),
  },
  I18nManager: { getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en_US' }) },
  ImageLoader: { prefetchImage: jest.fn(), getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))) },
  ImageViewManager: { prefetchImage: jest.fn(), getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))) },
  KeyboardObserver: { addListener: jest.fn(), removeListeners: jest.fn() },
  AppState: { getConstants: () => ({ initialAppState: 'active' }), addListener: jest.fn(), removeListeners: jest.fn() },
  Clipboard: { getString: jest.fn(() => Promise.resolve('')), setString: jest.fn() },
  ShareModule: { share: jest.fn(() => Promise.resolve()), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
  LinkingManager: { openURL: jest.fn(), canOpenURL: jest.fn(() => Promise.resolve(true)), getInitialURL: jest.fn(() => Promise.resolve(null)), addListener: jest.fn(), removeListeners: jest.fn() },
  AccessibilityManager: { announceForAccessibility: jest.fn(), setAccessibilityFocus: jest.fn(), getMultipleSupportsPresentation: jest.fn(), getReduceMotionFromFormatSettings: jest.fn() },
  NativeAnimatedModule: {
    getValue: jest.fn(), addAnimatedEventToView: jest.fn(), connectAnimatedNodes: jest.fn(), connectAnimatedNodeToView: jest.fn(), createAnimatedNode: jest.fn(), disconnectAnimatedNodeFromView: jest.fn(), disconnectAnimatedNodes: jest.fn(), dropAnimatedNode: jest.fn(), extractAnimatedNodeOffset: jest.fn(), flattenAnimatedNodeOffset: jest.fn(), removeAnimatedEventFromView: jest.fn(), restoreDefaultValues: jest.fn(), setAnimatedNodeOffset: jest.fn(), setAnimatedNodeValue: jest.fn(), startAnimatingNode: jest.fn(), startListeningToAnimatedNodeValue: jest.fn(), stopAnimation: jest.fn(), stopListeningToAnimatedNodeValue: jest.fn(), addListener: jest.fn(), removeListeners: jest.fn(),
  },
}

// Expose .default pointing to the same object — required by jest-expo setup.js
modules.default = modules
module.exports = modules
