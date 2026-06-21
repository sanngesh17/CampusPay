import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { journeyApi, type JourneyCase } from '../api/journey';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorNote, TextInput } from '../components/ui';
import { formatMinor } from '../lib/format';

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

  const queryText = search.toLowerCase();
  const visible = (caseData ?? []).filter((item) =>
    `${item.id} ${item.universityName} ${item.collectionReference} ${item.status} ${item.providerName} ${item.student?.name ?? ''} ${item.student?.email ?? ''} ${item.semesterLabel ?? ''}`
      .toLowerCase()
      .includes(queryText),
  );

  if (user.role === 'STUDENT') {
    return (
      <StudentPaymentsDashboard
        studentName={user.displayName}
        universityName={user.universityName ?? 'University'}
        search={search}
        setSearch={setSearch}
        cases={visible}
        isLoading={isLoading}
      />
    );
  }
  if (user.role === 'UNIVERSITY_FINANCE') {
    return (
      <UniversityFinanceDashboard
        universityName={user.universityName ?? 'University'}
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
    <OperationsDashboard
      title={user.displayName}
      search={search}
      setSearch={setSearch}
      cases={visible}
      isLoading={isLoading}
    />
  );
}

type DashboardAction = (run: () => Promise<JourneyCase>) => void;

function StudentPaymentsDashboard({
  studentName,
  universityName,
  search,
  setSearch,
  cases,
  isLoading,
}: {
  studentName: string;
  universityName: string;
  search: string;
  setSearch(value: string): void;
  cases: JourneyCase[];
  isLoading: boolean;
}) {
  const groups = studentSemesterGroups(cases);
  return (
    <>
      <DashboardIntro
        eyebrow="Student corridor"
        title={`${studentName} payments`}
        accent={universityName}
        subtitle="One university account with one live tuition payment per semester."
      />
      <div className="controls-row">
        <div className="search-wrapper">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search payments"
            placeholder="Search references, semester, provider or status..."
            className="search-input"
          />
        </div>
        <Link to="/payments/new" className="btn-primary">
          New payment &rarr;
        </Link>
      </div>
      <div className="grid gap-4">
        {groups.map((group) => (
          <section key={group.semester} className="list-wrapper">
            <div className="list-row !grid-cols-[1fr_auto] bg-[rgba(32,32,32,0.015)]">
              <div className="cell-student">{group.semester}</div>
              <span className="status-badge status-warning">{group.cases.length}</span>
            </div>
            {group.cases.map((item) => (
              <PaymentListRow key={item.id} item={item} studentLabel={group.semester} />
            ))}
          </section>
        ))}
        {isLoading ? <Card className="empty-state">Loading payments...</Card> : null}
        {!isLoading && cases.length === 0 ? (
          <Card className="empty-state">No payments match this queue.</Card>
        ) : null}
      </div>
    </>
  );
}

function UniversityFinanceDashboard({
  universityName,
  search,
  setSearch,
  cases,
  isLoading,
}: {
  universityName: string;
  search: string;
  setSearch(value: string): void;
  cases: JourneyCase[];
  isLoading: boolean;
}) {
  return (
    <>
      <DashboardIntro
        eyebrow="University corridor"
        title={`${universityName} finance`}
        accent="payment queue"
        subtitle="Student payment initiations routed to this partner college."
      />
      <div className="controls-row">
        <div className="search-wrapper">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search university payments"
            placeholder="Search references, students or universities..."
            className="search-input"
          />
        </div>
      </div>
      <PaymentList cases={cases} isLoading={isLoading} empty="No payments match this queue." />
    </>
  );
}

function LenderOfficerDashboard({
  title,
  search,
  setSearch,
  cases,
  isLoading,
  error,
  action,
}: {
  title: string;
  search: string;
  setSearch(value: string): void;
  cases: JourneyCase[];
  isLoading: boolean;
  error: string;
  action: DashboardAction;
}) {
  const buckets = lenderBuckets(cases);
  return (
    <>
      <DashboardIntro
        eyebrow="SBI disbursement"
        title={title}
        accent="approval desk"
        subtitle="Sanctioned-loan disbursements grouped by payment lifecycle."
      />
      <ErrorNote message={error} />
      <div className="controls-row">
        <div className="search-wrapper">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search lender cases"
            placeholder="Search university, reference, status or provider..."
            className="search-input"
          />
        </div>
      </div>
      <div className="grid gap-4">
        {buckets.map((bucket) => (
          <LenderBucketSection key={bucket.key} bucket={bucket} action={action} />
        ))}
        {isLoading ? <Card className="empty-state">Loading disbursement queue...</Card> : null}
        {!isLoading && cases.length === 0 ? (
          <Card className="empty-state">No cases match this queue.</Card>
        ) : null}
      </div>
    </>
  );
}

function OperationsDashboard({
  title,
  search,
  setSearch,
  cases,
  isLoading,
}: {
  title: string;
  search: string;
  setSearch(value: string): void;
  cases: JourneyCase[];
  isLoading: boolean;
}) {
  return (
    <>
      <DashboardIntro
        eyebrow="Operations corridor"
        title={`${title} dashboard`}
        accent="rail control"
        subtitle="Compliance, funding, payout and reconciliation queue."
      />
      <div className="controls-row">
        <div className="search-wrapper">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search cases"
            placeholder="Search case, reference, university or status..."
            className="search-input"
          />
        </div>
      </div>
      <PaymentList cases={cases} isLoading={isLoading} empty="No cases match this queue." />
    </>
  );
}

function DashboardIntro({
  eyebrow,
  title,
  accent,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
}) {
  return (
    <header className="dashboard-header">
      <span className="eyebrow">{eyebrow}</span>
      <h1>
        {title}, <span>{accent}</span>
      </h1>
      <p>{subtitle}</p>
    </header>
  );
}

function PaymentList({
  cases,
  isLoading,
  empty,
}: {
  cases: JourneyCase[];
  isLoading: boolean;
  empty: string;
}) {
  return (
    <main className="list-wrapper">
      {cases.map((item) => (
        <PaymentListRow key={item.id} item={item} />
      ))}
      {isLoading ? <div className="empty-state">Loading cases...</div> : null}
      {!isLoading && cases.length === 0 ? <div className="empty-state">{empty}</div> : null}
    </main>
  );
}

function PaymentListRow({ item, studentLabel }: { item: JourneyCase; studentLabel?: string }) {
  const updatedAt =
    item.lastUpdatedAt ?? item.payment?.updatedAt ?? item.instructionCreatedAt ?? item.createdAt;
  return (
    <Link to={`/payments/${item.id}`} className="list-row">
      <div className="cell-student">
        {item.student?.name || studentLabel || item.universityName}
        <span className="cell-email">
          {item.student?.email || `${item.semesterLabel ?? 'Semester 1'} · ${item.id.slice(0, 8)}`}
        </span>
      </div>
      <div className="cell-uni">
        {item.universityName}
        <span className="cell-ref">{item.collectionReference}</span>
      </div>
      <div className="cell-amount">
        {formatMinor(item.targetAmountMinor, item.targetCurrency)}
        <span className="cell-conv">{item.providerName}</span>
      </div>
      <div>
        <span className={`status-badge ${statusClass(item.status)}`}>
          {trackingLabel(item.status)}
        </span>
        <span className="cell-hash" title={item.id}>
          CASE: {item.id.slice(0, 10)}...
        </span>
      </div>
      <div className="cell-conv">{new Date(updatedAt).toLocaleString()}</div>
    </Link>
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
      cases: cases.filter((item) => attentionStatuses.includes(item.status)),
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
    <section className="list-wrapper">
      <div className="list-row !grid-cols-[1fr_auto] bg-[rgba(32,32,32,0.015)]">
        <div>
          <div className="cell-student">{bucket.title}</div>
          <span className="cell-email">{bucket.description}</span>
        </div>
        <span className="status-badge status-warning">{bucket.cases.length}</span>
      </div>
      {bucket.cases.length > 0 ? (
        bucket.cases.map((item) => (
          <LenderCaseRow key={item.id} bucketKey={bucket.key} item={item} action={action} />
        ))
      ) : (
        <div className="empty-state !py-6">No transactions in this category.</div>
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
  const [reference, setReference] = useState('UTR-2026-0001');
  const leg = lenderLeg(item);
  return (
    <div className="list-row">
      <Link to={`/payments/${item.id}`} className="cell-student">
        {item.universityName}
        <span className="cell-email">{item.collectionReference}</span>
      </Link>
      <Link to={`/payments/${item.id}`} className="cell-uni">
        {item.providerName}
        <span className="cell-ref">{item.id.slice(0, 8)}</span>
      </Link>
      <Link to={`/payments/${item.id}`} className="cell-amount">
        {formatMinor(item.targetAmountMinor, item.targetCurrency)}
        <span className="cell-conv">
          Lender {leg ? formatMinor(leg.requiredMinor, 'INR') : 'Not required'}
        </span>
      </Link>
      <div>
        <span className={`status-badge ${statusClass(item.status)}`}>
          {item.status.replaceAll('_', ' ')}
        </span>
      </div>
      <div className="row-actions">
        {bucketKey === 'pending' ? (
          <>
            <button
              className="btn-row-action primary"
              type="button"
              onClick={() => action(() => journeyApi.lenderDecision(item.id, 'APPROVE'))}
            >
              disburse leg
            </button>
            <button
              className="btn-row-action"
              type="button"
              onClick={() =>
                action(() =>
                  journeyApi.lenderDecision(item.id, 'CHANGES', 'Updated loan evidence required'),
                )
              }
            >
              clarify
            </button>
            <button
              className="btn-row-action"
              type="button"
              onClick={() =>
                action(() => journeyApi.lenderDecision(item.id, 'REJECT', 'Rejected by lender'))
              }
            >
              reject
            </button>
          </>
        ) : null}
        {bucketKey === 'approved' ? (
          <div className="grid gap-2">
            <TextInput
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              aria-label={`Transfer reference for ${item.collectionReference}`}
            />
            <button
              className="btn-row-action primary"
              type="button"
              onClick={() => action(() => journeyApi.lenderFunding(item.id, reference))}
              disabled={reference.trim().length < 4}
            >
              record UTR
            </button>
          </div>
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
      cases: items.sort((left, right) => updatedTime(right) - updatedTime(left)),
    }));
}

function semesterIndex(label: string): number {
  const match = /^Semester (\d+)$/.exec(label);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function updatedTime(item: JourneyCase): number {
  return new Date(
    item.lastUpdatedAt ?? item.payment?.updatedAt ?? item.instructionCreatedAt ?? item.createdAt,
  ).getTime();
}

function lenderLeg(item: JourneyCase) {
  return item.fundingLegs.find((leg) => leg.kind === 'LENDER');
}

const attentionStatuses = [
  'CHANGES_REQUESTED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
];

function statusClass(status: string): string {
  if (['COMPLETED', 'RECONCILED'].includes(status)) return 'status-success';
  if (attentionStatuses.includes(status)) return 'status-error';
  return 'status-warning';
}

function trackingLabel(status: string): string {
  if (['DRAFT', 'EVIDENCE_SUBMITTED'].includes(status)) return 'Payment initiated';
  if (['INSTRUCTION_ISSUED', 'FUNDING_PENDING'].includes(status)) return 'Awaiting funds';
  if (status === 'FUNDS_RECEIVED') return 'Funds received';
  if (['PAYOUT_SUBMITTED', 'VALIDATING'].includes(status)) return 'Payout submitted';
  if (status === 'TRANSFERRING') return 'Bank transfer in progress';
  if (['COMPLETED', 'RECONCILED'].includes(status)) return 'Delivered';
  if (status === 'CHANGES_REQUESTED') return 'Review';
  if (status === 'REFUND_PENDING') return 'Refund';
  return status.replaceAll('_', ' ').toLowerCase();
}
