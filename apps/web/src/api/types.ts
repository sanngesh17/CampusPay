export type Currency = 'INR' | 'GBP' | 'USD';

export interface MoneyView {
  minor: string;
  currency: string;
}

export interface QuoteView {
  id: string;
  fxRate: string;
  principalMinor: string;
  feesMinor: string;
  tcsMinor: string;
  finalPayableMinor: string;
  currency: string;
  expiresAt: string;
}

export interface CaseView {
  id: string;
  status: string;
  mode: string;
  funding: string;
  amount: MoneyView;
  rail?: string;
  beneficiary: { id: string; name: string };
  quote?: QuoteView;
}

export interface TimelineEntry {
  event: string;
  at: string;
  detail?: string;
}

export interface CaseDetailView extends CaseView {
  timeline: TimelineEntry[];
}

export interface ReceiptView {
  caseId: string;
  paymentId: string;
  rail: string;
  status: string;
  proofHash: string;
  amountPaid: MoneyView;
}

export interface CaseSummary {
  id: string;
  status: string;
  mode: string;
  beneficiary: string;
  amount: MoneyView;
  attestationCount: number;
}

export interface AttestationRecord {
  id: string;
  caseId: string;
  milestone: string;
  sha256: string;
  txHash?: string;
  createdAt: string;
}

export interface InitiateResult {
  paymentRef: { railId: string; paymentId: string };
  status: string;
  idempotent: boolean;
}

export interface CreateCaseBody {
  studentId: string;
  lenderId: string;
  beneficiaryId: string;
  amountMinor: string;
  currency: Currency;
  mode: 'INTEGRATED' | 'DIRECT';
  funding: 'LOAN' | 'SELF';
  reference?: string;
}
