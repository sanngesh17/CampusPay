import { firestoreJourneyApi } from './journeyFirestore';

export type FundingType = 'FULL_LOAN' | 'PARTIAL_LOAN' | 'SELF_FUNDED';
export interface JourneyCase {
  id: string;
  studentId: string;
  status: string;
  fundingType: FundingType;
  sourceAmountMinor: string;
  sourceCurrency: string;
  universityName: string;
  targetCurrency: string;
  targetAmountMinor: string;
  collectionReference: string;
  providerName: string;
  providerType: string;
  semesterLabel: string;
  student?: {
    name: string;
    email: string;
  };
  lenderName?: string;
  lenderApproved: boolean;
  feeBreakdown: {
    tuitionAdvanceMinor: string;
    courseDepositMinor: string;
    accommodationMinor: string;
    otherMinor: string;
  };
  fundingLegs: Array<{
    kind: 'LENDER' | 'STUDENT';
    requiredMinor: string;
    receivedMinor: string;
    funded: boolean;
  }>;
  documents: Array<{
    id: string;
    name: string;
    mimeType: string;
    sha256: string;
    uploadedAt: string;
  }>;
  compliance?: {
    outcome: string;
    route?: string;
    purposeCode?: string;
    approvalReference?: string;
    provider: string;
  };
  quote?: {
    id: string;
    targetAmountMinor: string;
    targetCurrency: string;
    feeMinor: string;
    taxMinor: string;
    fxRate: string;
    expiresAt: string;
    provider: string;
  };
  payment?: { id: string; status: string; provider: string; updatedAt: string };
  instructionCreatedAt?: string;
  receiptHash?: string;
  grievances: Array<{
    id: string;
    category: string;
    message: string;
    status: 'OPEN' | 'RESOLVED';
    createdAt: string;
    resolvedAt?: string;
  }>;
  privacyRequests: Array<{
    id: string;
    type: 'ACCESS' | 'CORRECTION' | 'ERASURE' | 'CONSENT_WITHDRAWAL';
    details: string;
    status: 'OPEN' | 'COMPLETED' | 'DECLINED';
    createdAt: string;
    resolvedAt?: string;
    outcome?: string;
  }>;
  consents: Array<{
    noticeVersion: string;
    purposes: string[];
    acceptedAt: string;
    withdrawnAt?: string;
  }>;
  legalHold?: { active: boolean; reason: string; setAt: string; releasedAt?: string };
  privacyErasedAt?: string;
  audit: Array<{ event: string; at: string; actorId?: string; detail?: string }>;
  createdAt: string;
  lastUpdatedAt?: string;
}

export const journeyApi = firestoreJourneyApi;
