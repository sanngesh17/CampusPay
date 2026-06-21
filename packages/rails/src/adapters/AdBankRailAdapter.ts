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
 * Rail B (> ₹25 lakh, AD-bank route) — stub. Eligibility is amounts above the cap; operations throw
 * NotImplemented until a bank integration exists.
 */
export class AdBankRailAdapter implements RailAdapter {
  readonly id: RailType = 'B';

  constructor(private readonly railConfig: RailConfig) {}

  supports(req: QuoteRequest): boolean {
    return req.sourceCurrency === 'INR' && req.amount.minor > BigInt(this.railConfig.capInrMinor);
  }

  getQuote(_req: QuoteRequest): Promise<Quote> {
    return Promise.reject(new NotImplementedError('AD-bank'));
  }

  initiatePayment(_req: InitiationRequest): Promise<PaymentRef> {
    return Promise.reject(new NotImplementedError('AD-bank'));
  }

  getStatus(_ref: PaymentRef): Promise<PaymentStatusUpdate> {
    return Promise.reject(new NotImplementedError('AD-bank'));
  }

  getReceipt(_ref: PaymentRef): Promise<Receipt> {
    return Promise.reject(new NotImplementedError('AD-bank'));
  }
}
