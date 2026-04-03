import type { Config } from 'jest'

const config: Config = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  roots:           ['<rootDir>/src/__tests__'],
  testMatch:       ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module:          'commonjs',
        esModuleInterop: true,
        strict:          false,
      },
    }],
  },
  moduleNameMapper: {
    '^@workfix/types$': '<rootDir>/../types/src/index.ts',
  },
}

export default config
