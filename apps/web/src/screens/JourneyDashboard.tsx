import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { journeyApi, type JourneyCase } from '../api/journey';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorNote, PageHeader, TextInput } from '../components/ui';
import { formatMinor } from '../lib/format';
import { useState } from 'react';

export function JourneyDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const { data: caseData, isLoading } = useQuery({
    queryKey: ['journey-cases', user?.id],
    queryFn: () => journeyApi.list(user!),
    enabled: !!user,
    refetchInterval: 2500,
  });
  const action = useMutation({
    mutationFn: async (run: () => Promise<JourneyCase>) => run(),
    onSuccess: async () => {
      setError('');
      await client.invalidateQueries({ queryKey: ['journey-cases', user?.id] });
    },
    onError: (cause) => setError((cause as Error).message),
  });
  if (!user) return <Navigate to="/login" replace />;
  const roleCopy =
    user.role === 'STUDENT'
      ? 'Your tuition payments and live partner status.'
      : user.role === 'UNIVERSITY_FINANCE'
        ? 'Student payment initiations routed to your college.'
        : user.role === 'LENDER_OFFICER'
          ? 'Sanctioned-loan disbursements assigned to your institution.'
          : 'Compliance, funding, payout and reconciliation queue.';
  const queryText = search.toLowerCase();
  const visible = (caseData ?? []).filter((item) =>
    `${item.id} ${item.universityName} ${item.collectionReference} ${item.status} ${item.providerName} ${item.student?.name ?? ''} ${item.student?.email ?? ''}`
      .toLowerCase()
      .includes(queryText),
  );
  if (user.role === 'STUDENT') {
    return (
      <StudentPaymentsDashboard
        studentName={user.displayName}
        universityName={user.universityName ?? 'University'}
        cases={visible}
        isLoading={isLoading}
      />
    );
  }
  if (user.role === 'UNIVERSITY_FINANCE') {
    return (
      <UniversityFinanceDashboard
        universityName={user.universityName ?? 'University'}
        subtitle={roleCopy}
        search={search}
        setSearch={setSearch}
        cases={visible}
        isLoading={isLoading}
      />
    );
  }
  if (user.role === 'LENDER_OFFICER') {
    return (
      <LenderOfficerDashboard
        title={user.displayName}
        subtitle={roleCopy}
        search={search}
        setSearch={setSearch}
        cases={visible}
        isLoading={isLoading}
        error={error}
        action={action.mutate}
      />
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={`${user.displayName} dashboard`} subtitle={roleCopy} />
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search cases"
        placeholder="Search case, reference, university or status"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <div className="grid gap-4">
        {visible.map((item) => (
          <Link key={item.id} to={`/payments/${item.id}`}>
            <Card className="flex items-center justify-between gap-6 p-5 transition hover:border-brand-300">
              <div>
                <div className="font-semibold text-slate-900">{item.universityName}</div>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  {item.collectionReference} · {item.id.slice(0, 8)}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {item.providerName} · {formatMinor(item.targetAmountMinor, item.targetCurrency)}
                </div>
              </div>
              <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {item.status.replaceAll('_', ' ')}
              </div>
            </Card>
          </Link>
        ))}
        {isLoading ? <Card className="p-8 text-center text-slate-400">Loading cases…</Card> : null}
        {!isLoading && visible.length === 0 ? (
          <Card className="p-10 text-center text-slate-400">No cases match this queue.</Card>
        ) : null}
      </div>
    </div>
  );
}

type DashboardAction = (run: () => Promise<JourneyCase>) => void;

function StudentPaymentsDashboard({
  studentName,
  universityName,
  cases,
  isLoading,
}: {
  studentName: string;
  universityName: string;
  cases: JourneyCase[];
  isLoading: boolean;
}) {
  const groups = studentSemesterGroups(cases);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title={`${studentName} payments`} subtitle={universityName} />
        <Link to="/payments/new">
          <Button>New payment</Button>
        </Link>
      </div>
      <div className="grid gap-4">
        {groups.map((group) => (
          <section
            key={group.semester}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h2 className="font-semibold text-slate-950">{group.semester}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {group.cases.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {group.cases.map((item) => {
                const updatedAt =
                  item.lastUpdatedAt ??
                  item.payment?.updatedAt ??
                  item.instructionCreatedAt ??
                  item.createdAt;
                return (
                  <Link
                    key={item.id}
                    to={`/payments/${item.id}`}
                    className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 md:grid-cols-[1fr_0.9fr_0.8fr_0.9fr] md:items-center md:gap-4"
                  >
                    <div>
                      <div className="font-mono text-xs font-semibold text-slate-700">
                        {item.collectionReference}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{item.id.slice(0, 8)}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {formatMinor(item.targetAmountMinor, item.targetCurrency)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{item.providerName}</div>
                    </div>
                    <div>
                      <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        {trackingLabel(item.status)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(updatedAt).toLocaleString()}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {isLoading ? (
          <Card className="p-8 text-center text-slate-400">Loading payments...</Card>
        ) : null}
        {!isLoading && cases.length === 0 ? (
          <Card className="p-10 text-center text-slate-400">No payments for this student yet.</Card>
        ) : null}
      </div>
    </div>
  );
}

function studentSemesterGroups(cases: JourneyCase[]) {
  const groups = new Map<string, JourneyCase[]>();
  for (const item of cases) {
    const semester = item.semesterLabel || 'Semester 1';
    groups.set(semester, [...(groups.get(semester) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => semesterIndex(left) - semesterIndex(right))
    .map(([semester, items]) => ({
      semester,
      cases: items.sort(
        (left, right) =>
          new Date(
            right.lastUpdatedAt ??
              right.payment?.updatedAt ??
              right.instructionCreatedAt ??
              right.createdAt,
          ).getTime() -
          new Date(
            left.lastUpdatedAt ??
              left.payment?.updatedAt ??
              left.instructionCreatedAt ??
              left.createdAt,
          ).getTime(),
      ),
    }));
}

function semesterIndex(label: string): number {
  const match = /^Semester (\d+)$/.exec(label);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function LenderOfficerDashboard({
  title,
  subtitle,
  search,
  setSearch,
  cases,
  isLoading,
  error,
  action,
}: {
  title: string;
  subtitle: string;
  search: string;
  setSearch(value: string): void;
  cases: JourneyCase[];
  isLoading: boolean;
  error: string;
  action: DashboardAction;
}) {
  const buckets = lenderBuckets(cases);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title={title} subtitle={subtitle} />
        <div className="text-sm font-medium text-slate-500">{cases.length} assigned cases</div>
      </div>
      <ErrorNote message={error} />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search lender cases"
        placeholder="Search university, reference, status or provider"
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <div className="grid gap-4">
        {buckets.map((bucket) => (
          <LenderBucketSection key={bucket.key} bucket={bucket} action={action} />
        ))}
        {isLoading ? (
          <Card className="p-8 text-center text-slate-400">Loading disbursement queue...</Card>
        ) : null}
        {!isLoading && cases.length === 0 ? (
          <Card className="p-10 text-center text-slate-400">No cases match this queue.</Card>
        ) : null}
      </div>
    </div>
  );
}

interface LenderBucket {
  key: string;
  title: string;
  description: string;
  cases: JourneyCase[];
}

function lenderBuckets(cases: JourneyCase[]): LenderBucket[] {
  return [
    {
      key: 'draft',
      title: 'Draft / Not Submitted',
      description: 'Created cases that have not reached lender approval.',
      cases: cases.filter((item) =>
        ['DRAFT', 'EVIDENCE_SUBMITTED', 'COMPLIANCE_PENDING', 'INSTRUCTION_ISSUED'].includes(
          item.status,
        ),
      ),
    },
    {
      key: 'pending',
      title: 'Pending Approval',
      description: 'Payment requests ready for SBI disbursement review.',
      cases: cases.filter((item) => item.status === 'FUNDING_PENDING' && !item.lenderApproved),
    },
    {
      key: 'approved',
      title: 'Approved / Awaiting Disbursement',
      description: 'Approved requests waiting for UTR and transfer confirmation.',
      cases: cases.filter(
        (item) =>
          item.status === 'FUNDING_PENDING' && item.lenderApproved && !lenderLeg(item)?.funded,
      ),
    },
    {
      key: 'processing',
      title: 'Funded / Processing',
      description: 'Lender funds are recorded and payout processing is underway.',
      cases: cases.filter(
        (item) =>
          Boolean(lenderLeg(item)?.funded) &&
          ['FUNDS_RECEIVED', 'PAYOUT_SUBMITTED', 'VALIDATING', 'TRANSFERRING'].includes(
            item.status,
          ),
      ),
    },
    {
      key: 'delivered',
      title: 'Delivered / Completed',
      description: 'Payments completed or reconciled after university delivery.',
      cases: cases.filter((item) => ['COMPLETED', 'RECONCILED'].includes(item.status)),
    },
    {
      key: 'attention',
      title: 'Attention / Closed',
      description: 'Cases that need changes, failed, expired, or are no longer active.',
      cases: cases.filter((item) =>
        [
          'CHANGES_REQUESTED',
          'REJECTED',
          'EXPIRED',
          'FAILED',
          'CANCELLED',
          'REFUND_PENDING',
        ].includes(item.status),
      ),
    },
  ];
}

function LenderBucketSection({
  bucket,
  action,
}: {
  bucket: LenderBucket;
  action: DashboardAction;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-950">{bucket.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{bucket.description}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {bucket.cases.length}
        </span>
      </div>
      {bucket.cases.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {bucket.cases.map((item) => (
            <LenderCaseRow key={item.id} bucketKey={bucket.key} item={item} action={action} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 text-sm text-slate-400">No transactions in this category.</div>
      )}
    </section>
  );
}

function LenderCaseRow({
  bucketKey,
  item,
  action,
}: {
  bucketKey: string;
  item: JourneyCase;
  action: DashboardAction;
}) {
  const [reference, setReference] = useState('UTR-DEMO-2026-0001');
  const leg = lenderLeg(item);
  const updatedAt =
    item.lastUpdatedAt ?? item.payment?.updatedAt ?? item.instructionCreatedAt ?? item.createdAt;
  return (
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.2fr_1fr_0.9fr] lg:items-center">
      <Link to={`/payments/${item.id}`} className="min-w-0">
        <div className="font-semibold text-slate-900">{item.universityName}</div>
        <div className="mt-1 font-mono text-xs text-slate-400">
          {item.collectionReference} · {item.id.slice(0, 8)}
        </div>
        <div className="mt-2 text-sm text-slate-500">
          Updated {new Date(updatedAt).toLocaleString()}
        </div>
      </Link>
      <Link to={`/payments/${item.id}`} className="text-sm">
        <div className="font-medium text-slate-900">{item.providerName}</div>
        <div className="mt-1 text-slate-500">
          University receives {formatMinor(item.targetAmountMinor, item.targetCurrency)}
        </div>
        <div className="mt-1 text-slate-500">
          Lender amount {leg ? formatMinor(leg.requiredMinor, 'INR') : 'Not required'}
        </div>
        <span className="mt-2 inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          {item.status.replaceAll('_', ' ')}
        </span>
      </Link>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {bucketKey === 'pending' ? (
          <>
            <Button onClick={() => action(() => journeyApi.lenderDecision(item.id, 'APPROVE'))}>
              Approve
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                action(() =>
                  journeyApi.lenderDecision(item.id, 'CHANGES', 'Updated loan evidence required'),
                )
              }
            >
              Request changes
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                action(() => journeyApi.lenderDecision(item.id, 'REJECT', 'Rejected by lender'))
              }
            >
              Reject
            </Button>
          </>
        ) : null}
        {bucketKey === 'approved' ? (
          <div className="grid w-full gap-2 sm:grid-cols-[1fr_auto] lg:max-w-md">
            <TextInput
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              aria-label={`Transfer reference for ${item.collectionReference}`}
            />
            <Button
              onClick={() => action(() => journeyApi.lenderFunding(item.id, reference))}
              disabled={reference.trim().length < 4}
            >
              Record UTR
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function lenderLeg(item: JourneyCase) {
  return item.fundingLegs.find((leg) => leg.kind === 'LENDER');
}

function UniversityFinanceDashboard({
  universityName,
  subtitle,
  search,
  setSearch,
  cases,
  isLoading,
}: {
  universityName: string;
  subtitle: string;
  search: string;
  setSearch(value: string): void;
  cases: JourneyCase[];
  isLoading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title={`${universityName} finance`} subtitle={subtitle} />
        <div className="text-sm font-medium text-slate-500">{cases.length} active payments</div>
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search university payments"
        placeholder="Search student, email, reference, provider or status"
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.35fr_1fr_0.9fr_0.9fr] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-md:hidden">
          <div>Student</div>
          <div>Reference</div>
          <div>Tracking</div>
          <div>Updated</div>
        </div>
        {cases.map((item) => (
          <Link
            key={item.id}
            to={`/payments/${item.id}`}
            className="grid gap-3 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50 md:grid-cols-[1.35fr_1fr_0.9fr_0.9fr] md:items-center md:gap-4"
          >
            <div>
              <div className="font-semibold text-slate-900">{item.student?.name || 'Student'}</div>
              <div className="mt-0.5 text-sm text-slate-500">{item.student?.email}</div>
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-slate-700">
                {item.collectionReference}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {formatMinor(item.targetAmountMinor, item.targetCurrency)} · {item.providerName}
              </div>
            </div>
            <div>
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {trackingLabel(item.status)}
              </span>
            </div>
            <div className="text-sm text-slate-500">
              {new Date(
                item.lastUpdatedAt ??
                  item.payment?.updatedAt ??
                  item.instructionCreatedAt ??
                  item.createdAt,
              ).toLocaleString()}
            </div>
          </Link>
        ))}
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading payments...</div>
        ) : null}
        {!isLoading && cases.length === 0 ? (
          <div className="p-10 text-center text-slate-400">No payments match this queue.</div>
        ) : null}
      </div>
    </div>
  );
}

function trackingLabel(status: string): string {
  if (['DRAFT', 'EVIDENCE_SUBMITTED'].includes(status)) return 'Payment initiated';
  if (['INSTRUCTION_ISSUED', 'FUNDING_PENDING'].includes(status)) return 'Awaiting funds';
  if (status === 'FUNDS_RECEIVED') return 'Funds received';
  if (['PAYOUT_SUBMITTED', 'VALIDATING'].includes(status)) return 'Payout submitted';
  if (status === 'TRANSFERRING') return 'Bank transfer in progress';
  if (['COMPLETED', 'RECONCILED'].includes(status)) return 'Delivered to university';
  if (status === 'CHANGES_REQUESTED') return 'Needs attention';
  if (status === 'REFUND_PENDING') return 'Refund pending';
  return status.replaceAll('_', ' ').toLowerCase();
}
