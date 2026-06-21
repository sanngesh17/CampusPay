export type PaymentsDirectStatus =
  | 'INITIATED'
  | 'VALIDATING'
  | 'TRANSFERRING'
  | 'COMPLETED'
  | 'FAILED';

export interface PaymentsDirectQuoteRequest {
  readonly caseId: string;
  readonly sourceAmountMinor: string;
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly taxMinor: string;
}

export interface PaymentsDirectQuote {
  readonly id: string;
  readonly sourceAmountMinor: string;
  readonly sourceCurrency: string;
  readonly targetAmountMinor: string;
  readonly targetCurrency: string;
  readonly feeMinor: string;
  readonly taxMinor: string;
  readonly fxRate: string;
  readonly expiresAt: string;
  readonly provider: string;
}

export interface PaymentsDirectPayment {
  readonly id: string;
  readonly quoteId: string;
  readonly status: PaymentsDirectStatus;
  readonly provider: string;
  readonly updatedAt: string;
}

export interface PaymentsDirectAdapter {
  createQuote(request: PaymentsDirectQuoteRequest): Promise<PaymentsDirectQuote>;
  createPayment(quote: PaymentsDirectQuote, idempotencyKey: string): Promise<PaymentsDirectPayment>;
  advance(paymentId: string): Promise<PaymentsDirectPayment>;
  fail(paymentId: string): Promise<PaymentsDirectPayment>;
}

export class SimulatedPaymentsDirect implements PaymentsDirectAdapter {
  private readonly payments = new Map<string, PaymentsDirectPayment>();

  async createQuote(request: PaymentsDirectQuoteRequest): Promise<PaymentsDirectQuote> {
    const rate = request.targetCurrency === 'GBP' ? 95n : 120n;
    const targetAmountMinor = ((BigInt(request.sourceAmountMinor) * rate) / 10_000n).toString();
    return {
      id: `SIM-Q-${request.caseId}`,
      sourceAmountMinor: request.sourceAmountMinor,
      sourceCurrency: request.sourceCurrency,
      targetAmountMinor,
      targetCurrency: request.targetCurrency,
      feeMinor: '50000',
      taxMinor: request.taxMinor,
      fxRate: request.targetCurrency === 'GBP' ? '0.0095' : '0.0120',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      provider: 'SIMULATED_PAYMENTS_DIRECT_2',
    };
  }

  async createPayment(
    quote: PaymentsDirectQuote,
    idempotencyKey: string,
  ): Promise<PaymentsDirectPayment> {
    const id = `SIM-P-${idempotencyKey}`;
    const existing = this.payments.get(id);
    if (existing) return existing;
    const payment = {
      id,
      quoteId: quote.id,
      status: 'INITIATED' as const,
      provider: 'SIMULATED_PAYMENTS_DIRECT_2',
      updatedAt: new Date().toISOString(),
    };
    this.payments.set(id, payment);
    return payment;
  }

  async advance(paymentId: string): Promise<PaymentsDirectPayment> {
    const current = this.payments.get(paymentId);
    if (!current) throw new Error('Unknown simulated payment');
    const next: Record<PaymentsDirectStatus, PaymentsDirectStatus> = {
      INITIATED: 'VALIDATING',
      VALIDATING: 'TRANSFERRING',
      TRANSFERRING: 'COMPLETED',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
    };
    const payment = {
      ...current,
      status: next[current.status],
      updatedAt: new Date().toISOString(),
    };
    this.payments.set(paymentId, payment);
    return payment;
  }

  async fail(paymentId: string): Promise<PaymentsDirectPayment> {
    const current = this.payments.get(paymentId);
    if (!current) throw new Error('Unknown simulated payment');
    const payment = { ...current, status: 'FAILED' as const, updatedAt: new Date().toISOString() };
    this.payments.set(paymentId, payment);
    return payment;
  }
}
