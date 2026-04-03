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
  ],
  coverageThreshold: {
    global: {
      branches:  50,
      functions: 60,
      lines:     60,
      statements: 60,
    },
  },
}

export default config
