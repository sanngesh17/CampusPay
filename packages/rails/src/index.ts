// @tuitionflow/rails — rail abstraction + adapters. The app depends on RailAdapter/RailRouter,
// never on a concrete partner.

export * from './types';
export * from './config';
export * from './errors';
export * from './RailAdapter';
export * from './RailRouter';
export * from './quote-builder';
export * from './compliance-partner';
export * from './payments-direct';
export * from './factory';
export { MockRailAdapter, type MockRailConfig } from './adapters/MockRailAdapter';
export { PacbRailAdapter } from './adapters/PacbRailAdapter';
export { AdBankRailAdapter } from './adapters/AdBankRailAdapter';
export { RippleRailAdapter } from './adapters/RippleRailAdapter';
