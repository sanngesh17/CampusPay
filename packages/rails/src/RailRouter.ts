import { NoEligibleRailError } from '@tuitionflow/domain';
import type { RailAdapter } from './RailAdapter';
import type { QuoteRequest } from './types';

/** Picks the first adapter whose `supports()` accepts the request (amount + eligibility + corridor). */
export class RailRouter {
  constructor(private readonly adapters: readonly RailAdapter[]) {}

  select(req: QuoteRequest): RailAdapter {
    const adapter = this.adapters.find((a) => a.supports(req));
    if (!adapter) {
      throw new NoEligibleRailError(
        `${req.amount.minor.toString()} ${req.sourceCurrency}->${req.targetCurrency}`,
      );
    }
    return adapter;
  }

  list(): readonly RailAdapter[] {
    return this.adapters;
  }
}
