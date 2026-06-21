/** Testnet integration tests (*.int.spec.ts). Faucet-funded ephemeral wallets; skips when offline. */

// xrpl 4.x and its deps (@xrplf/isomorphic = TS source, @noble/hashes = ESM) don't load cleanly
// under Jest's CJS runtime. Rather than fight module resolution, we let ts-jest transpile just those
// packages (everything else in node_modules stays ignored), which produces plain CJS Jest can run.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.int.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'node', 'ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', diagnostics: false }],
  },
  // xrpl keeps a WebSocket/keep-alive timer alive; we disconnect in afterAll but force a clean exit.
  forceExit: true,
  // Transpile the whole xrpl dependency stack (xrpl + ripple-* + @xrplf/* + @noble/* + @scure/*);
  // everything else in node_modules stays ignored.
  transformIgnorePatterns: [
    '/node_modules/\\.pnpm/(?!(xrpl|ripple-[^/@]+|@xrplf\\+[^/@]+|@noble\\+[^/@]+|@scure\\+[^/@]+)@)',
  ],
  testTimeout: 120000,
};
