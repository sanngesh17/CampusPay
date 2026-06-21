/** e2e tests for the NestJS API. Uses in-memory persistence + a recording XRPL gateway (no DB, no
 * network). Workspace domain/rails packages are mapped to source for live testing. */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.e2e-spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.testnet\\.e2e-spec\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@tuitionflow/domain$': '<rootDir>/../../packages/domain/src/index.ts',
    '^@tuitionflow/rails$': '<rootDir>/../../packages/rails/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testTimeout: 30000,
};
