import type { Quote, RailType } from '@tuitionflow/domain';
import type { RailConfig } from '../config';
import { NotImplementedError } from '../errors';
import type { RailAdapter } from '../RailAdapter';
import type {
  InitiationRequest,
  PaymentRef,
  PaymentStatusUpdate,
  QuoteRequest,
  Receipt,
} from '../types';

/**
 * Rail C (Ripple direct) — future, gated behind a feature flag. Only eligible when the flag is on
 * and the corridor is supported; operations throw NotImplemented until enabled.
 */
export class RippleRailAdapter implements RailAdapter {
  readonly id: RailType = 'C';

  constructor(private readonly railConfig: RailConfig) {}

  supports(req: QuoteRequest): boolean {
    return (
      this.railConfig.featureFlags.rippleRail === true &&
      this.railConfig.corridors.C.includes(req.targetCurrency)
    );
  }

  getQuote(_req: QuoteRequest): Promise<Quote> {
    return Promise.reject(new NotImplementedError('Ripple'));
  }

  initiatePayment(_req: InitiationRequest): Promise<PaymentRef> {
    return Promise.reject(new NotImplementedError('Ripple'));
  }

  getStatus(_ref: PaymentRef): Promise<PaymentStatusUpdate> {
    return Promise.reject(new NotImplementedError('Ripple'));
  }

  getReceipt(_ref: PaymentRef): Promise<Receipt> {
    return Promise.reject(new NotImplementedError('Ripple'));
  }
}
