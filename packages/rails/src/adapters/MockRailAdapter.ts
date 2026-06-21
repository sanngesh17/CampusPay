import { createHash } from 'node:crypto';
import type { Quote, RailType } from '@tuitionflow/domain';
import type { RailConfig, TcsConfig } from '../config';
import { RailError } from '../errors';
import { buildQuote, type QuoteConfig } from '../quote-builder';
import type { RailAdapter } from '../RailAdapter';
import type {
  InitiationRequest,
  PaymentRef,
  PaymentStatusUpdate,
  QuoteRequest,
  RailPaymentStatus,
  Receipt,
} from '../types';

const FLOW: readonly RailPaymentStatus[] = ['PENDING', 'KYC_VERIFIED', 'IN_SETTLEMENT', 'PAID'];

interface MockRecord {
  readonly req: InitiationRequest;
  step: number;
}

export interface MockRailConfig {
  readonly railConfig: RailConfig;
  readonly tcsConfig: TcsConfig;
  /** Injectable clock for deterministic tests. */
  readonly clock?: () => Date;
}

/**
 * MVP/demo rail. Simulates KYC pass, returns a deterministic quote (0% TCS for loan-funded), advances
 * status one step per poll (a stand-in for the partner's async timeline), and emits a fake receipt.
 * No real money moves. The ₹25L cap lives in supports(); the 0%-TCS logic lives in the quote builder.
 */
export class MockRailAdapter implements RailAdapter {
  readonly id: RailType = 'A';
  private readonly cfg: QuoteConfig;
  private readonly clock: () => Date;
  private readonly payments = new Map<string, MockRecord>();

  constructor(config: MockRailConfig) {
    this.cfg = { railConfig: config.railConfig, tcsConfig: config.tcsConfig };
    this.clock = config.clock ?? ((): Date => new Date());
  }

  supports(req: QuoteRequest): boolean {
    return (
      req.sourceCurrency === 'INR' && req.amount.minor <= BigInt(this.cfg.railConfig.capInrMinor)
    );
  }

  async getQuote(req: QuoteRequest): Promise<Quote> {
    return buildQuote(req, this.id, this.cfg, this.clock());
  }

  async initiatePayment(req: InitiationRequest): Promise<PaymentRef> {
    const paymentId = `MOCK-${req.idempotencyKey}`;
    // Idempotent: same key => same payment, never a duplicate.
    if (!this.payments.has(paymentId)) {
      this.payments.set(paymentId, { req, step: 0 });
    }
    return { railId: this.id, paymentId };
  }

  async getStatus(ref: PaymentRef): Promise<PaymentStatusUpdate> {
    const record = this.mustGet(ref.paymentId);
    if (record.step < FLOW.length - 1) record.step += 1;
    const status = FLOW[record.step] ?? 'PENDING';
    return { ref, status, updatedAt: this.clock() };
  }

  async getReceipt(ref: PaymentRef): Promise<Receipt> {
    const record = this.mustGet(ref.paymentId);
    if (FLOW[record.step] !== 'PAID') {
      throw new RailError('Receipt available only once payment is PAID', 'RECEIPT_NOT_READY');
    }
    const amountPaid = record.req.quote.finalPayable;
    const proofHash = createHash('sha256')
      .update(
        `${record.req.caseId}|${ref.paymentId}|${amountPaid.minor.toString()}|${amountPaid.currency}`,
      )
      .digest('hex');
    return {
      ref,
      caseId: record.req.caseId,
      amountPaid,
      paidAt: this.clock(),
      proofHash,
      rail: this.id,
    };
  }

  private mustGet(paymentId: string): MockRecord {
    const record = this.payments.get(paymentId);
    if (!record) throw new RailError(`Unknown payment: ${paymentId}`, 'UNKNOWN_PAYMENT');
    return record;
  }
}
