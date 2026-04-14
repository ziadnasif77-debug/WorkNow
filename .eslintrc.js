// ─────────────────────────────────────────────────────────────────────────────
// Root ESLint config — uses .js (not .json) so __dirname resolves project paths
// correctly when lint is invoked from sub-packages via turbo.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path')

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      path.resolve(__dirname, 'tsconfig.base.json'),
      path.resolve(__dirname, 'apps/mobile/tsconfig.json'),
      path.resolve(__dirname, 'functions/tsconfig.json'),
    ],
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // NOTE: recommended-requiring-type-checking removed — too strict for
    // test files and generates 1900+ false positives from jest/firebase mocks.
    // Type safety is enforced by tsc (typecheck script) instead.
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'e2e/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '.expo/', '.next/', '*.js', '!*.config.js', '!.eslintrc.js'],
}
