import type {
  AttestationRecord,
  CaseDetailView,
  CaseSummary,
  CaseView,
  CreateCaseBody,
  InitiateResult,
  ReceiptView,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(res.status, body.message ?? res.statusText, body.code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  createCase: (body: CreateCaseBody): Promise<CaseView> =>
    http('/cases', { method: 'POST', body: JSON.stringify(body) }),

  addDocuments: (id: string, documents: string[]): Promise<CaseView> =>
    http(`/cases/${id}/documents`, { method: 'POST', body: JSON.stringify({ documents }) }),

  validate: (id: string): Promise<CaseView> => http(`/cases/${id}/validate`, { method: 'POST' }),

  quote: (id: string): Promise<CaseView> => http(`/cases/${id}/quote`, { method: 'POST' }),

  initiate: (id: string): Promise<InitiateResult> =>
    http(`/cases/${id}/initiate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),

  settle: (id: string): Promise<{ status: string }> =>
    http(`/cases/${id}/settle`, { method: 'POST' }),

  getCase: (id: string): Promise<CaseDetailView> => http(`/cases/${id}`),

  getReceipt: (id: string): Promise<ReceiptView> => http(`/cases/${id}/receipt`),

  listCases: (): Promise<CaseSummary[]> => http('/admin/cases'),

  listAttestations: (id: string): Promise<AttestationRecord[]> => http(`/admin/attestations/${id}`),
};
