import type { CaseStatus, Currency, PaymentMode } from '@tuitionflow/domain';
import type { FundingType, RailType } from '@tuitionflow/rails';

/** Persistence shapes (plain, JSON-safe). Money is BigInt minor units serialized as a string. */

export interface StoredQuote {
  id: string;
  fxRate: string;
  principalMinor: string;
  feesMinor: string;
  tcsMinor: string;
  finalPayableMinor: string;
  currency: Currency;
  expiresAt: string;
}

export interface StoredPayment {
  railId: RailType;
  paymentId: string;
  status: string;
  receiptHash?: string;
}

export interface StoredCase {
  id: string;
  status: CaseStatus;
  mode: PaymentMode;
  funding: FundingType;
  amountMinor: string;
  currency: Currency;
  student: { id: string; displayName: string };
  lender: { id: string; name: string };
  beneficiary: {
    id: string;
    name: string;
    currency: Currency;
    referenceRule: string;
    beneficiaryRef: string;
  };
  rail?: RailType;
  reference?: string;
  quote?: StoredQuote;
  payment?: StoredPayment;
  failureReason?: string;
  createdAt: string;
}

export interface StoredStudent {
  id: string;
  fullName: string;
  email: string;
  countryOfStudy: string;
  panCipher?: string;
  passportCipher?: string;
  bankAccountCipher?: string;
  keyRef?: string;
}

export interface StoredLender {
  id: string;
  name: string;
  type: string;
}

export interface StoredUniversity {
  id: string;
  name: string;
  country: string;
  currency: Currency;
  referenceRule: string;
  beneficiaryRef: string;
}

export interface AttestationRecord {
  id: string;
  caseId: string;
  milestone: string;
  sha256: string;
  txHash?: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  caseId?: string;
  event: string;
  detail?: string;
  createdAt: string;
}
