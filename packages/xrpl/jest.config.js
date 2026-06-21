/** Unit + security tests only (no network). Integration tests use jest.integration.config.js. */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.int\\.spec\\.ts$', '/node_modules/'],
  // 'js' before 'ts' so node_modules deps (xrpl, @xrplf/*) resolve to their compiled JS, not src .ts.
  moduleFileExtensions: ['js', 'json', 'node', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};
