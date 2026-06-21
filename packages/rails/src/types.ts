import type { Currency, Money, PaymentMode, Quote, RailType } from '@tuitionflow/domain';

export type { RailType } from '@tuitionflow/domain';

/** How the remittance is funded — drives TCS (loan = 0%). */
export type FundingType = 'LOAN' | 'SELF';

export interface QuoteRequest {
  /** Principal in the source currency (INR minor units). */
  readonly amount: Money;
  readonly sourceCurrency: Currency;
  readonly targetCurrency: Currency;
  readonly mode: PaymentMode;
  readonly funding: FundingType;
  readonly corridor?: string;
}

export interface InitiationRequest {
  readonly quote: Quote;
  readonly caseId: string;
  readonly beneficiaryRef: string;
  readonly reference: string;
  /** Carried end-to-end so a retried initiate never double-pays. */
  readonly idempotencyKey: string;
}

export interface PaymentRef {
  readonly railId: RailType;
  readonly paymentId: string;
}

export type RailPaymentStatus = 'PENDING' | 'KYC_VERIFIED' | 'IN_SETTLEMENT' | 'PAID' | 'FAILED';

export interface PaymentStatusUpdate {
  readonly ref: PaymentRef;
  readonly status: RailPaymentStatus;
  readonly updatedAt: Date;
}

export interface Receipt {
  readonly ref: PaymentRef;
  readonly caseId: string;
  readonly amountPaid: Money;
  readonly paidAt: Date;
  /** sha256 of the receipt payload — anchored on-chain as the PAID/RECEIPT attestation. */
  readonly proofHash: string;
  readonly rail: RailType;
}
