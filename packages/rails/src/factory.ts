import type { RailConfig, TcsConfig } from './config';
import { AdBankRailAdapter } from './adapters/AdBankRailAdapter';
import { MockRailAdapter } from './adapters/MockRailAdapter';
import { RippleRailAdapter } from './adapters/RippleRailAdapter';
import type { RailAdapter } from './RailAdapter';
import { RailRouter } from './RailRouter';

/**
 * MVP wiring: Mock stands in for Rail A (≤ ₹25L), AD-bank stub covers Rail B (> ₹25L), and the
 * Ripple rail is included only when its feature flag is on. The PA-CB stub is intentionally left out
 * of the default router (Mock plays Rail A for the demo) but is exported for future swap-in.
 */
export function createRailRouter(
  railConfig: RailConfig,
  tcsConfig: TcsConfig,
  clock?: () => Date,
): RailRouter {
  const adapters: RailAdapter[] = [
    new MockRailAdapter({ railConfig, tcsConfig, ...(clock ? { clock } : {}) }),
    new AdBankRailAdapter(railConfig),
  ];
  if (railConfig.featureFlags.rippleRail) {
    adapters.push(new RippleRailAdapter(railConfig));
  }
  return new RailRouter(adapters);
}
