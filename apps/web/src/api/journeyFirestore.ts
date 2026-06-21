import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import type { AuthUser } from '../auth/AuthContext';
import { firestoreDb } from '../firebase/client';
import type { JourneyCase } from './journey';

const CASES = 'journeyCases';

export const firestoreJourneyApi = {
  async list(user: AuthUser): Promise<JourneyCase[]> {
    const snapshot = await getDocs(collection(firestoreDb, CASES));
    return snapshot.docs
      .map((item) => normalizeCase(item.id, item.data()))
      .filter((item) => canSee(item, user))
      .map((item) => sanitizeForRole(item, user))
      .sort((left, right) => updatedTime(right) - updatedTime(left));
  },

  async get(id: string): Promise<JourneyCase> {
    const user = currentUser();
    const item = await mustGet(id);
    if (!canSee(item, user)) throw new Error('Case is not assigned to this user');
    return sanitizeForRole(item, user);
  },

  async create(body: Record<string, unknown>): Promise<JourneyCase> {
    const user = currentUser();
    if (user.role !== 'STUDENT') throw new Error('Only students can create payment requests');
    const universityName = user.universityName ?? String(body.universityName ?? '');
    const semesterLabel = String(body.semesterLabel ?? 'Semester 1');
    const existing = await firestoreJourneyApi.list(user);
    if (
      existing.some(
        (item) => item.universityName === universityName && item.semesterLabel === semesterLabel,
      )
    ) {
      throw new Error('A payment already exists for this semester');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const lenderAmountMinor = String(body.lenderAmountMinor ?? body.amountMinor ?? '0');
    const item: JourneyCase = {
      id,
      studentId: user.id,
      status: 'DRAFT',
      fundingType: String(body.fundingType ?? 'FULL_LOAN') as JourneyCase['fundingType'],
      sourceAmountMinor: String(body.amountMinor ?? '0'),
      sourceCurrency: 'INR',
      universityName,
      targetCurrency: String(body.targetCurrency ?? 'GBP'),
      targetAmountMinor: String(body.targetAmountMinor ?? '0'),
      collectionReference: `TF-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
      providerName: String(body.providerName ?? body.lenderName ?? 'State Bank of India'),
      providerType: String(body.providerType ?? 'BANK'),
      semesterLabel,
      student: {
        name: [body.firstName, body.middleName, body.familyName]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
          .join(' '),
        email: String(body.studentEmail ?? user.email),
      },
      lenderName: String(body.lenderName ?? body.providerName ?? 'State Bank of India'),
      lenderApproved: false,
      feeBreakdown: {
        tuitionAdvanceMinor: String(
          (body.feeBreakdown as JourneyCase['feeBreakdown'] | undefined)?.tuitionAdvanceMinor ??
            '0',
        ),
        courseDepositMinor: String(
          (body.feeBreakdown as JourneyCase['feeBreakdown'] | undefined)?.courseDepositMinor ?? '0',
        ),
        accommodationMinor: String(
          (body.feeBreakdown as JourneyCase['feeBreakdown'] | undefined)?.accommodationMinor ?? '0',
        ),
        otherMinor: String(
          (body.feeBreakdown as JourneyCase['feeBreakdown'] | undefined)?.otherMinor ?? '0',
        ),
      },
      fundingLegs: [
        {
          kind: 'LENDER',
          requiredMinor: lenderAmountMinor,
          receivedMinor: '0',
          funded: false,
        },
      ],
      documents: [],
      grievances: [],
      privacyRequests: [],
      consents: [],
      audit: [{ event: 'CASE_CREATED', at: now, actorId: user.id }],
      createdAt: now,
      lastUpdatedAt: now,
    };
    await setDoc(doc(firestoreDb, CASES, id), { ...item, lenderId: String(body.lenderId ?? '') });
    return item;
  },

  async upload(id: string, file: File): Promise<JourneyCase> {
    const user = currentUser();
    const item = await writableCase(id, user);
    const now = new Date().toISOString();
    const documentId = crypto.randomUUID();
    const sha256 = await fileHash(file);
    const next: Partial<JourneyCase> = {
      documents: [
        ...item.documents,
        {
          id: documentId,
          name: file.name.replace(/[^A-Za-z0-9._ -]/g, '_'),
          mimeType: file.type || 'application/octet-stream',
          sha256,
          uploadedAt: now,
        },
      ],
      lastUpdatedAt: now,
      audit: [...item.audit, { event: 'EVIDENCE_UPLOADED', at: now, actorId: user.id }],
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async submit(id: string): Promise<JourneyCase> {
    const user = currentUser();
    const item = await writableCase(id, user);
    if (item.documents.length === 0) throw new Error('At least one evidence document is required');
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      status: 'FUNDING_PENDING',
      compliance: {
        outcome: 'APPROVED',
        route: 'LRS_EDUCATION',
        purposeCode: 'S0305',
        approvalReference: `CP-${id.slice(0, 8).toUpperCase()}`,
        provider: 'Simulated PA-CB',
      },
      instructionCreatedAt: now,
      consents: [
        ...item.consents,
        {
          noticeVersion: 'privacy-notice-2025-11-v1',
          purposes: ['PAYMENT_ORCHESTRATION', 'REGULATORY_COMPLIANCE', 'CASE_SUPPORT'],
          acceptedAt: now,
        },
      ],
      audit: [
        ...item.audit,
        { event: 'DECLARATIONS_ACCEPTED', at: now, actorId: user.id },
        { event: 'PARTNER_COMPLIANCE_APPROVED', at: now, actorId: 'FIREBASE_SIMULATION' },
        { event: 'INSTRUCTION_GENERATED', at: now, actorId: 'FIREBASE_SIMULATION' },
      ],
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async lenderDecision(id: string, decision: string, reason?: string): Promise<JourneyCase> {
    const user = currentUser();
    const item = await lenderCase(id, user);
    if (item.status !== 'FUNDING_PENDING') {
      throw new Error('Case is not awaiting lender disbursement');
    }
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> =
      decision === 'APPROVE'
        ? { lenderApproved: true }
        : { status: decision === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED' };
    next.audit = [
      ...item.audit,
      {
        event: `LENDER_${decision}`,
        at: now,
        actorId: user.id,
        ...(reason ? { detail: reason } : {}),
      },
    ];
    next.lastUpdatedAt = now;
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async lenderFunding(id: string, transferReference: string): Promise<JourneyCase> {
    return recordFunding(id, 'LENDER', transferReference);
  },

  async opsFunding(id: string, kind: string, transferReference: string): Promise<JourneyCase> {
    return recordFunding(id, kind, transferReference);
  },

  async quote(id: string): Promise<JourneyCase> {
    const item = await opsCase(id);
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      quote: {
        id: `quote-${id.slice(0, 8)}`,
        targetAmountMinor: item.targetAmountMinor,
        targetCurrency: item.targetCurrency,
        feeMinor: '0',
        taxMinor: '0',
        fxRate: '0.0100',
        expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        provider: 'Firebase simulation',
      },
      audit: [...item.audit, { event: 'FINAL_QUOTE_CREATED', at: now, actorId: currentUser().id }],
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async payout(id: string): Promise<JourneyCase> {
    const item = await opsCase(id);
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      status: 'PAYOUT_SUBMITTED',
      payment: {
        id: `pay-${id.slice(0, 8)}`,
        status: 'SUBMITTED',
        provider: 'MockRail',
        updatedAt: now,
      },
      audit: [...item.audit, { event: 'PAYOUT_SUBMITTED', at: now, actorId: currentUser().id }],
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async advance(id: string): Promise<JourneyCase> {
    const item = await opsCase(id);
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      status: item.status === 'PAYOUT_SUBMITTED' ? 'VALIDATING' : 'TRANSFERRING',
      payment: {
        id: item.payment?.id ?? `pay-${id.slice(0, 8)}`,
        status: 'PROCESSING',
        provider: item.payment?.provider ?? 'MockRail',
        updatedAt: now,
      },
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async reconcile(id: string): Promise<JourneyCase> {
    const item = await opsCase(id);
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      status: 'RECONCILED',
      receiptHash: await hashText(`${id}:${now}`),
      payment: {
        id: item.payment?.id ?? `pay-${id.slice(0, 8)}`,
        status: 'RECONCILED',
        provider: item.payment?.provider ?? 'MockRail',
        updatedAt: now,
      },
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async fail(id: string): Promise<JourneyCase> {
    const item = await opsCase(id);
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      status: 'FAILED',
      payment: {
        id: item.payment?.id ?? `pay-${id.slice(0, 8)}`,
        status: 'FAILED',
        provider: item.payment?.provider ?? 'MockRail',
        updatedAt: now,
      },
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  async grievance(id: string, category: string, message: string): Promise<JourneyCase> {
    const item = await mustGet(id);
    const now = new Date().toISOString();
    const next: Partial<JourneyCase> = {
      grievances: [
        ...item.grievances,
        { id: crypto.randomUUID(), category, message, status: 'OPEN', createdAt: now },
      ],
      lastUpdatedAt: now,
    };
    await updateDoc(doc(firestoreDb, CASES, id), next);
    return { ...item, ...next };
  },

  resolveGrievance: async (id: string) => mustGet(id),
  privacyRequest: async (id: string) => mustGet(id),
  resolvePrivacyRequest: async (id: string) => mustGet(id),
  legalHold: async (id: string) => mustGet(id),
  instructionUrl: () => '#',
  downloadInstruction: unavailableDownload,
  downloadDocument: unavailableDownload,
  downloadReceipt: unavailableDownload,
  downloadPersonalData: unavailableDownload,
};

async function mustGet(id: string): Promise<JourneyCase> {
  const snapshot = await getDoc(doc(firestoreDb, CASES, id));
  if (!snapshot.exists()) throw new Error('Payment was not found');
  return normalizeCase(snapshot.id, snapshot.data());
}

async function writableCase(id: string, user: AuthUser): Promise<JourneyCase> {
  const item = await mustGet(id);
  if (user.role !== 'STUDENT' || item.studentId !== user.id) {
    throw new Error('Case is not assigned to this user');
  }
  return item;
}

async function lenderCase(id: string, user: AuthUser): Promise<JourneyCase> {
  const item = await mustGet(id);
  if (user.role !== 'LENDER_OFFICER' || !isLenderCase(item, user)) {
    throw new Error('Case is not assigned to this lender');
  }
  return item;
}

async function opsCase(id: string): Promise<JourneyCase> {
  const user = currentUser();
  if (user.role !== 'PAYMENT_OPS') throw new Error('Payment operations access is required');
  return mustGet(id);
}

async function recordFunding(
  id: string,
  kind: string,
  transferReference: string,
): Promise<JourneyCase> {
  const user = currentUser();
  const item =
    kind === 'LENDER'
      ? await lenderCase(id, user)
      : user.role === 'PAYMENT_OPS'
        ? await mustGet(id)
        : undefined;
  if (!item) throw new Error('Payment operations access is required');
  if (kind === 'LENDER' && !item.lenderApproved) throw new Error('Lender approval is required');
  const now = new Date().toISOString();
  const fundingLegs = item.fundingLegs.map((leg) =>
    leg.kind === kind
      ? { ...leg, receivedMinor: leg.requiredMinor, funded: true, transferReference }
      : leg,
  );
  const next: Partial<JourneyCase> = {
    fundingLegs,
    status: fundingLegs.every((leg) => leg.funded) ? 'FUNDS_RECEIVED' : item.status,
    audit: [
      ...item.audit,
      { event: `${kind}_FUNDING_CONFIRMED`, at: now, actorId: user.id, detail: transferReference },
    ],
    lastUpdatedAt: now,
  };
  await updateDoc(doc(firestoreDb, CASES, id), next);
  return { ...item, ...next };
}

function currentUser(): AuthUser {
  const value = sessionStorage.getItem('tf_user:v1');
  if (!value) throw new Error('Please sign in');
  return JSON.parse(value) as AuthUser;
}

function canSee(item: JourneyCase, user: AuthUser): boolean {
  if (user.role === 'PAYMENT_OPS') return true;
  if (user.role === 'STUDENT') {
    return item.studentId === user.id && item.universityName === user.universityName;
  }
  if (user.role === 'UNIVERSITY_FINANCE') return item.universityName === user.universityName;
  return isLenderCase(item, user);
}

function isLenderCase(item: JourneyCase, user: AuthUser): boolean {
  const lenderId = (item as JourneyCase & { lenderId?: string }).lenderId;
  return lenderId === user.lenderId || item.providerName.toLowerCase().includes('state bank');
}

function sanitizeForRole(item: JourneyCase, user: AuthUser): JourneyCase {
  if (user.role !== 'UNIVERSITY_FINANCE') return item;
  return {
    ...item,
    documents: [],
    compliance: undefined,
    grievances: [],
    privacyRequests: [],
    consents: [],
    legalHold: undefined,
    audit: [],
  };
}

function normalizeCase(id: string, value: DocumentData): JourneyCase {
  return {
    id,
    studentId: String(value.studentId ?? ''),
    status: String(value.status ?? 'DRAFT'),
    fundingType: String(value.fundingType ?? 'FULL_LOAN') as JourneyCase['fundingType'],
    sourceAmountMinor: String(value.sourceAmountMinor ?? '0'),
    sourceCurrency: String(value.sourceCurrency ?? 'INR'),
    universityName: String(value.universityName ?? ''),
    targetCurrency: String(value.targetCurrency ?? 'GBP'),
    targetAmountMinor: String(value.targetAmountMinor ?? '0'),
    collectionReference: String(value.collectionReference ?? `TF-${id.slice(0, 8).toUpperCase()}`),
    providerName: String(value.providerName ?? 'State Bank of India'),
    providerType: String(value.providerType ?? 'BANK'),
    semesterLabel: String(value.semesterLabel ?? 'Semester 1'),
    ...(value.student ? { student: value.student as JourneyCase['student'] } : {}),
    ...(value.lenderName ? { lenderName: String(value.lenderName) } : {}),
    lenderApproved: Boolean(value.lenderApproved),
    feeBreakdown: (value.feeBreakdown ?? {
      tuitionAdvanceMinor: value.targetAmountMinor ?? '0',
      courseDepositMinor: '0',
      accommodationMinor: '0',
      otherMinor: '0',
    }) as JourneyCase['feeBreakdown'],
    fundingLegs: (value.fundingLegs ?? []) as JourneyCase['fundingLegs'],
    documents: (value.documents ?? []) as JourneyCase['documents'],
    ...(value.compliance ? { compliance: value.compliance as JourneyCase['compliance'] } : {}),
    ...(value.quote ? { quote: value.quote as JourneyCase['quote'] } : {}),
    ...(value.payment ? { payment: value.payment as JourneyCase['payment'] } : {}),
    ...(value.instructionCreatedAt
      ? { instructionCreatedAt: String(value.instructionCreatedAt) }
      : {}),
    ...(value.receiptHash ? { receiptHash: String(value.receiptHash) } : {}),
    grievances: (value.grievances ?? []) as JourneyCase['grievances'],
    privacyRequests: (value.privacyRequests ?? []) as JourneyCase['privacyRequests'],
    consents: (value.consents ?? []) as JourneyCase['consents'],
    ...(value.legalHold ? { legalHold: value.legalHold as JourneyCase['legalHold'] } : {}),
    ...(value.privacyErasedAt ? { privacyErasedAt: String(value.privacyErasedAt) } : {}),
    audit: (value.audit ?? []) as JourneyCase['audit'],
    createdAt: String(value.createdAt ?? new Date().toISOString()),
    ...(value.lastUpdatedAt ? { lastUpdatedAt: String(value.lastUpdatedAt) } : {}),
    ...(value.lenderId ? { lenderId: String(value.lenderId) } : {}),
  } as JourneyCase;
}

function updatedTime(item: JourneyCase): number {
  return new Date(item.lastUpdatedAt ?? item.payment?.updatedAt ?? item.createdAt).getTime();
}

async function fileHash(file: File): Promise<string> {
  return hashBuffer(await file.arrayBuffer());
}

async function hashText(value: string): Promise<string> {
  return hashBuffer(new TextEncoder().encode(value));
}

async function hashBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes =
    buffer instanceof Uint8Array ? new Uint8Array(buffer).buffer : new Uint8Array(buffer).buffer;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function unavailableDownload(): Promise<never> {
  throw new Error('Downloads are not available in the Firebase deployment.');
}
