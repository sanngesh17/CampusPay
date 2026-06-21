/* global console, fetch, process */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'campuspay-xrpl';
const databaseId = '(default)';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
  encoding: 'utf8',
}).trim();

const now = new Date().toISOString();

const cases = [
  paymentCase({
    id: '5f0ef6dd-86a6-468a-a9f5-41c1e76f7051',
    studentId: 'student-a',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@tuitionflow.local',
    universityName: 'University of Warwick',
    semesterLabel: 'Semester 1',
    status: 'FUNDING_PENDING',
    lenderApproved: false,
  }),
  paymentCase({
    id: '9b4c67d9-0f78-40df-aa7a-3d7ff345837d',
    studentId: 'student-a',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@tuitionflow.local',
    universityName: 'University of Warwick',
    semesterLabel: 'Semester 3',
    status: 'FUNDING_PENDING',
    lenderApproved: true,
  }),
  paymentCase({
    id: '89c650ff-f691-41d9-9165-27f9ccbc2656',
    studentId: 'student-a',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@tuitionflow.local',
    universityName: 'University of Warwick',
    semesterLabel: 'Semester 6',
    status: 'FUNDS_RECEIVED',
    lenderApproved: true,
    funded: true,
  }),
  paymentCase({
    id: '35f1a8df-5fe8-41bb-8de9-6c4ed60a5f47',
    studentId: 'student-a',
    studentName: 'Aarav Sharma',
    studentEmail: 'student@tuitionflow.local',
    universityName: 'University of Warwick',
    semesterLabel: 'Semester 7',
    status: 'RECONCILED',
    lenderApproved: true,
    funded: true,
    paymentStatus: 'RECONCILED',
  }),
  paymentCase({
    id: 'be7f540d-05e4-4b79-a348-72b48ef3160a',
    studentId: 'student-b',
    studentName: 'Diya Patel',
    studentEmail: 'diya.patel@example.com',
    universityName: 'University of Oxford',
    semesterLabel: 'Semester 2',
    status: 'FUNDING_PENDING',
    lenderApproved: false,
  }),
  paymentCase({
    id: 'b0f74822-423e-4c76-a583-f8d6093d00f7',
    studentId: 'student-c',
    studentName: 'Rohan Mehta',
    studentEmail: 'rohan.mehta@example.com',
    universityName: 'University of Cambridge',
    semesterLabel: 'Semester 4',
    status: 'CHANGES_REQUESTED',
    lenderApproved: false,
  }),
];

await deleteCollection('journeyCases');
for (const item of cases) {
  await writeDocument(`journeyCases/${item.id}`, item);
}

console.log(`Seeded ${cases.length} Firestore payment records in ${projectId}.`);

function paymentCase({
  id,
  studentId,
  studentName,
  studentEmail,
  universityName,
  semesterLabel,
  status,
  lenderApproved,
  funded = false,
  paymentStatus,
}) {
  const suffix = createHash('sha1').update(id).digest('hex').slice(0, 8).toUpperCase();
  const lastUpdatedAt =
    status === 'RECONCILED'
      ? new Date(Date.now() - 2 * 60 * 60_000).toISOString()
      : status === 'FUNDS_RECEIVED'
        ? new Date(Date.now() - 45 * 60_000).toISOString()
        : now;
  return {
    id,
    studentId,
    status,
    fundingType: 'FULL_LOAN',
    sourceAmountMinor: '1275204000',
    sourceCurrency: 'INR',
    universityName,
    targetCurrency: 'GBP',
    targetAmountMinor: '1000000',
    collectionReference: `TF-2026-${suffix}`,
    providerName: 'State Bank of India',
    providerType: 'BANK',
    lenderId: 'lender-sbi',
    lenderName: 'State Bank of India',
    semesterLabel,
    student: {
      name: studentName,
      email: studentEmail,
    },
    lenderApproved,
    feeBreakdown: {
      tuitionAdvanceMinor: '1000000',
      courseDepositMinor: '0',
      accommodationMinor: '0',
      otherMinor: '0',
    },
    fundingLegs: [
      {
        kind: 'LENDER',
        requiredMinor: '1275204000',
        receivedMinor: funded ? '1275204000' : '0',
        funded,
      },
    ],
    documents: [
      {
        id: `${id}-evidence`,
        name: 'sanction-letter.pdf',
        mimeType: 'application/pdf',
        sha256: `${suffix.toLowerCase().padEnd(64, '0')}`,
        uploadedAt: lastUpdatedAt,
      },
    ],
    compliance: {
      outcome: 'APPROVED',
      route: 'LRS_EDUCATION',
      purposeCode: 'S0305',
      approvalReference: `CP-${suffix}`,
      provider: 'Simulated PA-CB',
    },
    ...(paymentStatus
      ? {
          payment: {
            id: `pay-${suffix}`,
            status: paymentStatus,
            provider: 'MockRail',
            updatedAt: lastUpdatedAt,
          },
          receiptHash: `${suffix.toLowerCase().padStart(64, '1')}`,
        }
      : {}),
    instructionCreatedAt: lastUpdatedAt,
    grievances: [],
    privacyRequests: [],
    consents: [
      {
        noticeVersion: 'privacy-notice-2025-11-v1',
        purposes: ['PAYMENT_ORCHESTRATION', 'REGULATORY_COMPLIANCE', 'CASE_SUPPORT'],
        acceptedAt: lastUpdatedAt,
      },
    ],
    audit: [
      { event: 'CASE_CREATED', at: lastUpdatedAt, actorId: studentId },
      { event: 'EVIDENCE_UPLOADED', at: lastUpdatedAt, actorId: studentId },
      { event: 'DECLARATIONS_ACCEPTED', at: lastUpdatedAt, actorId: studentId },
    ],
    createdAt: lastUpdatedAt,
    lastUpdatedAt,
  };
}

async function deleteCollection(collectionName) {
  const response = await fetch(`${baseUrl}/${collectionName}`, {
    headers: authHeaders(),
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(await response.text());
  const body = await response.json();
  await Promise.all((body.documents ?? []).map((item) => deleteDocument(item.name)));
}

async function deleteDocument(name) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

async function writeDocument(path, value) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(value) }),
  });
  if (!response.ok) throw new Error(await response.text());
}

function authHeaders() {
  return { Authorization: `Bearer ${token}` };
}

function toFirestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]));
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  return { mapValue: { fields: toFirestoreFields(value) } };
}
