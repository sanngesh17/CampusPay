import type { Quote, RailType } from '@tuitionflow/domain';
import type {
  InitiationRequest,
  PaymentRef,
  PaymentStatusUpdate,
  QuoteRequest,
  Receipt,
} from './types';

/**
 * The one interface every rail hides behind. The app never imports a concrete partner — it depends
 * on this abstraction and lets the RailRouter pick an implementation.
 */
export interface RailAdapter {
  readonly id: RailType;
  /** Eligibility gate, e.g. Rail A only if amount ≤ ₹25L. Config-driven. */
  supports(req: QuoteRequest): boolean;
  getQuote(req: QuoteRequest): Promise<Quote>;
  initiatePayment(req: InitiationRequest): Promise<PaymentRef>;
  getStatus(ref: PaymentRef): Promise<PaymentStatusUpdate>;
  getReceipt(ref: PaymentRef): Promise<Receipt>;
}
