import type { AuthUser } from '../auth/AuthContext';
import { firestoreJourneyApi } from './journeyFirestore';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const DATA_BACKEND = (import.meta.env.VITE_DATA_BACKEND as string | undefined) ?? 'firestore';
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

function token(): string {
  const value = sessionStorage.getItem('tf_token:v1');
  if (!value) throw new Error('Please sign in');
  return value;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const send = () =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  let response = await send();
  if (response.status === 401) {
    const refreshed = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      const session = (await refreshed.json()) as { accessToken: string; user: AuthUser };
      sessionStorage.setItem('tf_token:v1', session.accessToken);
      sessionStorage.setItem('tf_user:v1', JSON.stringify(session.user));
      response = await send();
    } else {
      sessionStorage.removeItem('tf_token:v1');
      sessionStorage.removeItem('tf_user:v1');
      throw new Error('Session expired. Please sign in again.');
    }
  }
  if (!response.ok) {
    const body = (await parseJson(response).catch(() => ({}))) as { message?: string };
    const message = (body.message ?? response.statusText).toLowerCase();
    if (message.includes('invalid or expired access token') || message.includes('unauthorized')) {
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(body.message ?? response.statusText);
  }
  return parseJson(response) as Promise<T>;
}

async function parseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'API is not configured for this deployment. Set VITE_API_URL to the hosted API URL.',
    );
  }
  return response.json();
}
const httpJourneyApi = {
  list: (user: AuthUser) =>
    request<JourneyCase[]>(
      user.role === 'STUDENT'
        ? '/api/cases'
        : user.role === 'LENDER_OFFICER'
          ? '/api/lender/cases'
          : user.role === 'UNIVERSITY_FINANCE'
            ? '/api/cases'
            : '/api/operations/cases',
    ),
  get: (id: string) => request<JourneyCase>(`/api/cases/${id}`),
  create: (body: Record<string, unknown>) =>
    request<JourneyCase>('/api/cases', { method: 'POST', body: JSON.stringify(body) }),
  upload: (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<JourneyCase>(`/api/cases/${id}/documents`, { method: 'POST', body });
  },
  submit: (id: string) => request<JourneyCase>(`/api/cases/${id}/submit`, { method: 'POST' }),
  lenderDecision: (id: string, decision: string, reason?: string) =>
    request<JourneyCase>(`/api/lender/cases/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }),
  lenderFunding: (id: string, transferReference: string) =>
    request<JourneyCase>(`/api/lender/cases/${id}/funding`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'LENDER', transferReference }),
    }),
  opsFunding: (id: string, kind: string, transferReference: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/funding`, {
      method: 'POST',
      body: JSON.stringify({ kind, transferReference }),
    }),
  quote: (id: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/quote`, { method: 'POST' }),
  payout: (id: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/payout`, {
      method: 'POST',
      headers: { 'Idempotency-Key': stableKey(id, 'payout') },
    }),
  advance: (id: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/payout/advance`, { method: 'POST' }),
  reconcile: (id: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/reconcile`, { method: 'POST' }),
  fail: (id: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/payout/fail`, { method: 'POST' }),
  grievance: (id: string, category: string, message: string) =>
    request<JourneyCase>(`/api/cases/${id}/grievances`, {
      method: 'POST',
      body: JSON.stringify({ category, message }),
    }),
  resolveGrievance: (id: string, grievanceId: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/grievances/${grievanceId}/resolve`, {
      method: 'POST',
    }),
  privacyRequest: (id: string, type: string, details: string) =>
    request<JourneyCase>(`/api/cases/${id}/privacy-requests`, {
      method: 'POST',
      body: JSON.stringify({ type, details }),
    }),
  resolvePrivacyRequest: (
    id: string,
    requestId: string,
    decision: 'COMPLETED' | 'DECLINED',
    outcome: string,
  ) =>
    request<JourneyCase>(`/api/operations/cases/${id}/privacy-requests/${requestId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, outcome }),
    }),
  legalHold: (id: string, active: boolean, reason: string) =>
    request<JourneyCase>(`/api/operations/cases/${id}/legal-hold`, {
      method: 'POST',
      body: JSON.stringify({ active, reason }),
    }),
  instructionUrl: (id: string) => `${BASE}/api/cases/${id}/instruction`,
  async downloadInstruction(id: string) {
    const response = await fetch(`${BASE}/api/cases/${id}/instruction`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!response.ok) throw new Error('Instruction is not available');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tuitionflow-${id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async downloadDocument(caseId: string, documentId: string, name: string) {
    const response = await fetch(`${BASE}/api/cases/${caseId}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!response.ok) throw new Error('Evidence is not available');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async downloadReceipt(id: string) {
    const response = await fetch(`${BASE}/api/cases/${id}/receipt`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!response.ok) throw new Error('Receipt is not available');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tuitionflow-receipt-${id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async downloadPersonalData(id: string) {
    const response = await fetch(`${BASE}/api/cases/${id}/privacy-export`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!response.ok) throw new Error('Personal data export is not available');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tuitionflow-data-${id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};

export const journeyApi = DATA_BACKEND === 'firestore' ? firestoreJourneyApi : httpJourneyApi;

function stableKey(id: string, operation: string): string {
  const key = `tf_idem_${operation}_${id}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}
