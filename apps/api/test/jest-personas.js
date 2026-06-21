/** Testnet persona e2e — boots the API with the REAL XrplClient and verifies on-chain attestations.
 * Transpiles the xrpl dependency stack so it loads under Jest (see jest-xrpl-esm note). Skips when
 * Testnet is unreachable. Run with: pnpm --filter @tuitionflow/api test:personas */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.testnet.e2e-spec.ts'],
  moduleFileExtensions: ['js', 'json', 'node', 'ts'],
  moduleNameMapper: {
    '^@tuitionflow/domain$': '<rootDir>/../../packages/domain/src/index.ts',
    '^@tuitionflow/rails$': '<rootDir>/../../packages/rails/src/index.ts',
  },
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      { tsconfig: '<rootDir>/test/tsconfig.personas.json', diagnostics: false },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/\\.pnpm/(?!(xrpl|ripple-[^/@]+|@xrplf\\+[^/@]+|@noble\\+[^/@]+|@scure\\+[^/@]+)@)',
  ],
  forceExit: true,
  testTimeout: 180000,
};
