/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/jest.setup.js',
  ],
  // Tell jest where to resolve bare module imports from
  modulePaths: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@workfix/types$':  '<rootDir>/../../packages/types/src/index.ts',
    '^@workfix/utils$':  '<rootDir>/../../packages/utils/src/index.ts',
    '^@workfix/config$': '<rootDir>/../../packages/config/src/index.ts',
    '\\.(png|jpg|jpeg|gif|svg|ttf|woff|woff2)$': '<rootDir>/__mocks__/fileMock.js',
    // Explicit alias for constants (relative import from components/ui)
    '^(\.{1,2}/)+constants/theme$': '<rootDir>/src/constants/theme.ts',
  },
  transformIgnorePatterns: [
    '../../node_modules/.pnpm/(?!(' +
      '(jest-)?react-native[^/]*' +
      '|@react-native[^/]*' +
      '|expo[^/]*' +
      '|@expo[^/]*' +
      '|react-native-reanimated' +
      '|react-native-mmkv' +
      '|react-native-gesture-handler' +
      '|react-native-safe-area-context' +
      '|react-native-screens' +
      '|react-native-webview' +
      '|nativewind' +
      '|@sentry/' +
      '|@react-native-firebase/' +
      '|@react-native-async-storage/' +
      '|@react-native-community/' +
    '))',
  ],
  collectCoverageFrom: [
    'src/screens/**/*.{ts,tsx}',
    'src/stores/**/*.ts',
    'src/hooks/**/*.ts',
    'src/components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**',
  ],
  coverageThreshold: {
    global: { branches: 40, functions: 50, lines: 50 },
  },
}
