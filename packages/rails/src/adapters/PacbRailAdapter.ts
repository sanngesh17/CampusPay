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
 * Real Rail A (≤ ₹25 lakh) — partner-facing shape, not yet wired to a sandbox. Eligibility matches
 * the MVP cap; every operation throws NotImplemented until a partner integration exists.
 */
export class PacbRailAdapter implements RailAdapter {
  readonly id: RailType = 'A';

  constructor(private readonly railConfig: RailConfig) {}

  supports(req: QuoteRequest): boolean {
    return req.sourceCurrency === 'INR' && req.amount.minor <= BigInt(this.railConfig.capInrMinor);
  }

  getQuote(_req: QuoteRequest): Promise<Quote> {
    return Promise.reject(new NotImplementedError('PA-CB'));
  }

  initiatePayment(_req: InitiationRequest): Promise<PaymentRef> {
    return Promise.reject(new NotImplementedError('PA-CB'));
  }

  getStatus(_ref: PaymentRef): Promise<PaymentStatusUpdate> {
    return Promise.reject(new NotImplementedError('PA-CB'));
  }

  getReceipt(_ref: PaymentRef): Promise<Receipt> {
    return Promise.reject(new NotImplementedError('PA-CB'));
  }
}
