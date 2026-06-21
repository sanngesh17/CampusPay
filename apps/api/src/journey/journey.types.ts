import type { RemittanceCase, RemittanceFundingType } from '@tuitionflow/domain';
import type {
  ComplianceDecision,
  PaymentsDirectPayment,
  PaymentsDirectQuote,
} from '@tuitionflow/rails';

export interface JourneyDocument {
  id: string;
  name: string;
  mimeType: string;
  sha256: string;
  encryptedPath: string;
  uploadedAt: string;
}
export interface JourneyAudit {
  event: string;
  actorId: string;
  at: string;
  detail?: string;
}
export interface FeeBreakdown {
  tuitionAdvanceMinor: string;
  courseDepositMinor: string;
  accommodationMinor: string;
  otherMinor: string;
}
export interface JourneyGrievance {
  id: string;
  category: string;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string;
}
export type PrivacyRequestType = 'ACCESS' | 'CORRECTION' | 'ERASURE' | 'CONSENT_WITHDRAWAL';
export interface JourneyPrivacyRequest {
  id: string;
  type: PrivacyRequestType;
  details: string;
  status: 'OPEN' | 'COMPLETED' | 'DECLINED';
  createdAt: string;
  resolvedAt?: string;
  outcome?: string;
}
export interface JourneyConsent {
  noticeVersion: string;
  purposes: string[];
  acceptedAt: string;
  withdrawnAt?: string;
}
export interface JourneyLegalHold {
  active: boolean;
  reason: string;
  setAt: string;
  setBy: string;
  releasedAt?: string;
  releasedBy?: string;
}
export interface JourneyCaseRecord {
  domain: RemittanceCase;
  universityName: string;
  destinationCountry: string;
  targetCurrency: 'GBP' | 'USD';
  targetAmountMinor: string;
  feeBreakdown: FeeBreakdown;
  providerName: string;
  providerType: 'BANK' | 'NBFC';
  semesterLabel: string;
  personalDetailsCipher: string;
  collectionReference: string;
  lenderId?: string;
  lenderName?: string;
  branchNameCipher?: string;
  loanAccountCipher?: string;
  sanctionReferenceCipher?: string;
  documents: JourneyDocument[];
  declarationsAccepted: boolean;
  lenderApproved: boolean;
  compliance?: ComplianceDecision;
  quote?: PaymentsDirectQuote;
  payment?: PaymentsDirectPayment;
  instructionHash?: string;
  instructionPath?: string;
  instructionCreatedAt?: string;
  receiptHash?: string;
  receiptPath?: string;
  payoutIdempotencyKey?: string;
  webhookEventIds: string[];
  grievances: JourneyGrievance[];
  privacyRequests: JourneyPrivacyRequest[];
  consents: JourneyConsent[];
  legalHold?: JourneyLegalHold;
  privacyErasedAt?: string;
  audit: JourneyAudit[];
  createdAt: string;
}

export interface CreateJourneyInput {
  fundingType: RemittanceFundingType;
  amountMinor: string;
  lenderAmountMinor?: string;
  lenderId?: string;
  lenderName?: string;
  branchName?: string;
  loanAccountNumber?: string;
  sanctionReference?: string;
  universityName: string;
  destinationCountry: string;
  targetCurrency: 'GBP' | 'USD';
  targetAmountMinor: string;
  feeBreakdown: FeeBreakdown;
  providerName: string;
  providerType: 'BANK' | 'NBFC';
  semesterLabel?: string;
  studentEmail: string;
  firstName: string;
  middleName?: string;
  familyName: string;
  pinCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  phone: string;
  payerName: string;
  payerRelationship: string;
  payerPan: string;
}
