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

export interface CaseSummary {
  id: string;
  status: string;
  mode: string;
  beneficiary: string;
  amount: MoneyView;
  attestationCount: number;
}

export interface ReceiptView {
  caseId: string;
  paymentId: string;
  rail: string;
  status: string;
  proofHash: string;
  amountPaid: MoneyView;
}
