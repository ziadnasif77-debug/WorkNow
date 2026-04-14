import type { Config } from 'jest'

const config: Config = {
  preset:              'ts-jest',
  testEnvironment:     'node',
  roots:               ['<rootDir>/src/__tests__'],
  testMatch:           ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module:           'commonjs',
        esModuleInterop:  true,
        strict:           false,  // relaxed for tests
      },
    }],
  },
  moduleNameMapper: {
    '^@workfix/types$':  '<rootDir>/../packages/types/src/index.ts',
    '^@workfix/utils$':  '<rootDir>/../packages/utils/src/index.ts',
    '^@workfix/config$': '<rootDir>/../packages/config/src/index.ts',
  },
  // setupFilesAfterFramework removed (typo)
  testTimeout:         30000,
  verbose:             true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/index.ts',
    // Infrastructure files tested via integration tests, not unit tests:
    '!src/_shared/queue.ts',
    '!src/_shared/monitoring.ts',
    '!src/_shared/webhooks.ts',
    '!src/billing/generateInvoice.ts',
    '!src/user/dataExport.ts',
  ],
  coverageThreshold: {
    global: {
      branches:  55,
      functions: 65,
      lines:     65,
      statements: 65,
    },
  },
}

export default config
