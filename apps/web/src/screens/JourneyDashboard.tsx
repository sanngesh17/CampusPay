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
  return <OperationsDashboard title={user.displayName} cases={visible} isLoading={isLoading} />;
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
  const sortedCases = [...cases].sort(
    (left, right) =>
      semesterIndex(left.semesterLabel || 'Semester 1') -
      semesterIndex(right.semesterLabel || 'Semester 1'),
  );
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
        <main className="list-wrapper">
          {sortedCases.map((item) => (
            <PaymentListRow
              key={item.id}
              item={item}
              studentLabel={item.semesterLabel || 'Semester 1'}
            />
          ))}
          {isLoading ? <div className="empty-state">Loading payments...</div> : null}
          {!isLoading && cases.length === 0 ? (
            <div className="empty-state">No payments match this queue.</div>
          ) : null}
        </main>
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
  cases,
  isLoading,
}: {
  title: string;
  cases: JourneyCase[];
  isLoading: boolean;
}) {
  const metrics = operationsMetrics(cases);
  const actionRows = operationsPriorityRows(cases).slice(0, 4);
  return (
    <>
      <DashboardIntro
        eyebrow="Operations corridor"
        title={`${title} control`}
        accent="daily summary"
        subtitle="Funding, payout, reconciliation, and exceptions at a glance."
      />

      <section className="ops-hero-card">
        <div>
          <span className="mono-label">Portfolio in motion</span>
          <div className="ops-hero-value">{formatMinor(metrics.totalTargetMinor, 'GBP')}</div>
          <p>
            {metrics.totalCases} active payment records across {metrics.universityCount} partner
            colleges.
          </p>
        </div>
        <div className="ops-hero-side">
          <span className="status-badge status-warning">
            {metrics.awaitingFunds} awaiting funds
          </span>
          <span className="status-badge status-success">
            {metrics.reconciliationRate}% reconciled
          </span>
        </div>
      </section>

      <section className="metrics-bar ops-metrics-bar">
        <OpsMetricCard
          index="01"
          label="Funding queue"
          value={metrics.awaitingFunds.toString()}
          footer={`${formatMinor(metrics.awaitingFundingMinor, 'INR')} expected from lenders`}
        />
        <OpsMetricCard
          index="02"
          label="Funds received"
          value={metrics.fundedCount.toString()}
          footer={`${formatMinor(metrics.fundedMinor, 'INR')} ready or processing`}
        />
        <OpsMetricCard
          index="03"
          label="Payout pipeline"
          value={metrics.payoutPipeline.toString()}
          footer="Submitted, validating, or transferring"
        />
        <OpsMetricCard
          index="04"
          label="Exceptions"
          value={metrics.attentionCount.toString()}
          footer="Needs review, failed, cancelled, or refund pending"
          tone={metrics.attentionCount > 0 ? 'warning' : 'success'}
        />
      </section>

      <section className="ops-workbench">
        <div className="ops-workbench-main">
          <div className="ops-section-header">
            <div>
              <span className="mono-label">Action queue</span>
              <h2>Priority transactions</h2>
            </div>
            <Link to="/operations/transactions" className="btn-secondary">
              View all transactions &rarr;
            </Link>
          </div>
          <div className="ops-priority-list">
            {actionRows.map((item) => (
              <Link key={item.id} to={`/payments/${item.id}`} className="ops-priority-row">
                <div>
                  <div className="cell-student">{item.collectionReference}</div>
                  <span className="cell-email">
                    {item.universityName} · {item.student?.name ?? item.semesterLabel}
                  </span>
                </div>
                <div className="cell-amount">
                  {formatMinor(item.targetAmountMinor, item.targetCurrency)}
                </div>
                <span className={`status-badge ${statusClass(item.status)}`}>
                  {trackingLabel(item.status)}
                </span>
              </Link>
            ))}
            {isLoading ? (
              <div className="empty-state !py-6">Loading operations queue...</div>
            ) : null}
            {!isLoading && actionRows.length === 0 ? (
              <div className="empty-state !py-6">No transactions need attention.</div>
            ) : null}
          </div>
        </div>
        <aside className="ops-status-panel">
          <span className="mono-label">Lifecycle mix</span>
          <h2>Status distribution</h2>
          <StatusBar
            label="Awaiting funds"
            count={metrics.awaitingFunds}
            total={metrics.totalCases}
          />
          <StatusBar
            label="Funded / processing"
            count={metrics.processingCount}
            total={metrics.totalCases}
          />
          <StatusBar label="Delivered" count={metrics.deliveredCount} total={metrics.totalCases} />
          <StatusBar label="Attention" count={metrics.attentionCount} total={metrics.totalCases} />
        </aside>
      </section>
    </>
  );
}

export function OperationsTransactionsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { data: caseData, isLoading } = useQuery({
    queryKey: ['journey-cases', user?.id, 'operations-transactions'],
    queryFn: () => journeyApi.list(user!),
    enabled: !!user && user.role === 'PAYMENT_OPS',
    refetchInterval: 2500,
  });

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'PAYMENT_OPS') return <Navigate to="/dashboard" replace />;

  const queryText = search.toLowerCase();
  const visible = (caseData ?? []).filter((item) =>
    `${item.id} ${item.universityName} ${item.collectionReference} ${item.status} ${item.providerName} ${item.student?.name ?? ''} ${item.student?.email ?? ''} ${item.semesterLabel ?? ''}`
      .toLowerCase()
      .includes(queryText),
  );

  return (
    <>
      <DashboardIntro
        eyebrow="Operations ledger"
        title="Transaction"
        accent="workbench"
        subtitle="Search and inspect every payment record routed through CampusPay."
      />
      <div className="controls-row">
        <Link to="/dashboard" className="btn-secondary">
          &larr; Summary
        </Link>
        <div className="search-wrapper">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search cases"
            placeholder="Search case, reference, university, provider or status..."
            className="search-input"
          />
        </div>
      </div>
      <PaymentList cases={visible} isLoading={isLoading} empty="No cases match this queue." />
    </>
  );
}

function OpsMetricCard({
  index,
  label,
  value,
  footer,
  tone = 'neutral',
}: {
  index: string;
  label: string;
  value: string;
  footer: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <article className={`metric-card ops-metric-card ops-metric-${tone}`}>
      <span className="metric-num-badge">{index}</span>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-footer">{footer}</div>
    </article>
  );
}

function StatusBar({ label, count, total }: { label: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="status-bar">
      <div className="status-bar-head">
        <span>{label}</span>
        <span>
          {count} · {percentage}%
        </span>
      </div>
      <div className="status-bar-track" aria-hidden="true">
        <span className="status-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

interface OperationsMetrics {
  totalCases: number;
  universityCount: number;
  totalTargetMinor: string;
  awaitingFunds: number;
  awaitingFundingMinor: string;
  fundedCount: number;
  fundedMinor: string;
  payoutPipeline: number;
  processingCount: number;
  deliveredCount: number;
  attentionCount: number;
  reconciliationRate: number;
}

function operationsMetrics(cases: JourneyCase[]): OperationsMetrics {
  const totalTarget = cases.reduce((sum, item) => sum + BigInt(item.targetAmountMinor), 0n);
  const universities = new Set(cases.map((item) => item.universityName).filter(Boolean));
  const awaiting = cases.filter((item) => item.status === 'FUNDING_PENDING');
  const fundedStatuses = ['FUNDS_RECEIVED', 'PAYOUT_SUBMITTED', 'VALIDATING', 'TRANSFERRING'];
  const delivered = cases.filter((item) => ['COMPLETED', 'RECONCILED'].includes(item.status));
  const attention = cases.filter((item) => attentionStatuses.includes(item.status));
  const payoutPipeline = cases.filter((item) =>
    ['PAYOUT_SUBMITTED', 'VALIDATING', 'TRANSFERRING'].includes(item.status),
  );
  const processing = cases.filter((item) => fundedStatuses.includes(item.status));
  const funded = cases.filter(
    (item) => item.fundingLegs.some((leg) => leg.funded) || fundedStatuses.includes(item.status),
  );
  const awaitingFundingMinor = awaiting.reduce(
    (sum, item) =>
      sum +
      item.fundingLegs.reduce((legSum, leg) => {
        const required = BigInt(leg.requiredMinor);
        const received = BigInt(leg.receivedMinor);
        const outstanding = required > received ? required - received : 0n;
        return legSum + outstanding;
      }, 0n),
    0n,
  );
  const fundedMinor = cases.reduce(
    (sum, item) =>
      sum +
      item.fundingLegs.reduce((legSum, leg) => {
        if (!leg.funded) return legSum;
        return legSum + BigInt(leg.receivedMinor);
      }, 0n),
    0n,
  );

  return {
    totalCases: cases.length,
    universityCount: universities.size,
    totalTargetMinor: totalTarget.toString(),
    awaitingFunds: awaiting.length,
    awaitingFundingMinor: awaitingFundingMinor.toString(),
    fundedCount: funded.length,
    fundedMinor: fundedMinor.toString(),
    payoutPipeline: payoutPipeline.length,
    processingCount: processing.length,
    deliveredCount: delivered.length,
    attentionCount: attention.length,
    reconciliationRate: cases.length > 0 ? Math.round((delivered.length / cases.length) * 100) : 0,
  };
}

function operationsPriorityRows(cases: JourneyCase[]): JourneyCase[] {
  return [...cases].sort((left, right) => {
    const priorityDelta = operationsPriority(left) - operationsPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return updatedTime(right) - updatedTime(left);
  });
}

function operationsPriority(item: JourneyCase): number {
  if (attentionStatuses.includes(item.status)) return 0;
  if (item.status === 'FUNDING_PENDING') return 1;
  if (['FUNDS_RECEIVED', 'PAYOUT_SUBMITTED', 'VALIDATING', 'TRANSFERRING'].includes(item.status)) {
    return 2;
  }
  if (['COMPLETED', 'RECONCILED'].includes(item.status)) return 4;
  return 3;
}

function updatedTime(item: JourneyCase): number {
  const value =
    item.lastUpdatedAt ?? item.payment?.updatedAt ?? item.instructionCreatedAt ?? item.createdAt;
  return new Date(value).getTime();
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
        {studentLabel || item.student?.name || item.universityName}
        <span className="cell-email">
          {studentLabel
            ? `${item.semesterLabel ?? studentLabel} · ${item.id.slice(0, 8)}`
            : item.student?.email ||
              `${item.semesterLabel ?? 'Semester 1'} · ${item.id.slice(0, 8)}`}
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

function semesterIndex(label: string): number {
  const match = /^Semester (\d+)$/.exec(label);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
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
