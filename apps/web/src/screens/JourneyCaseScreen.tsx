import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { journeyApi, type JourneyCase } from '../api/journey';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorNote } from '../components/ui';
import { formatMinor } from '../lib/format';

export function JourneyCaseScreen() {
  const { user } = useAuth();
  const id = useParams().id ?? '';
  const { data: item, error: queryError } = useQuery({
    queryKey: ['journey-case', id],
    queryFn: () => journeyApi.get(id),
    enabled: !!user && !!id,
    refetchInterval: 2000,
  });

  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <ErrorNote message={(queryError as Error | null)?.message} />
      {item ? (
        <>
          <PaymentTrackingPanel item={item} />
          <PaymentDetailsPanel item={item} />
        </>
      ) : (
        <Card className="empty-state">Loading payment tracking...</Card>
      )}
    </>
  );
}

const TRACKING_STEPS = [
  { key: 'initiated', label: 'Payment initiated', statuses: ['DRAFT', 'EVIDENCE_SUBMITTED'] },
  {
    key: 'funding',
    label: 'Awaiting funds',
    statuses: ['INSTRUCTION_ISSUED', 'FUNDING_PENDING'],
  },
  { key: 'received', label: 'Funds received', statuses: ['FUNDS_RECEIVED'] },
  {
    key: 'submitted',
    label: 'Payout submitted',
    statuses: ['PAYOUT_SUBMITTED', 'VALIDATING'],
  },
  { key: 'transfer', label: 'Bank transfer in progress', statuses: ['TRANSFERRING'] },
  { key: 'delivered', label: 'Delivered to university', statuses: ['COMPLETED', 'RECONCILED'] },
] as const;

const STOPPED_LABELS: Record<string, string> = {
  CHANGES_REQUESTED: 'Needs updated information',
  REJECTED: 'Payment could not be approved',
  EXPIRED: 'Payment instruction expired',
  FAILED: 'Payment failed',
  CANCELLED: 'Payment cancelled',
  REFUND_PENDING: 'Refund pending',
};

function PaymentTrackingPanel({ item }: { item: JourneyCase }) {
  return (
    <section className="list-wrapper">
      <div className="list-row !grid-cols-[1fr_auto] bg-[rgba(32,32,32,0.015)]">
        <div>
          <span className="eyebrow !justify-start">Payment processing</span>
          <div className="cell-student text-[24px] leading-tight">Payment tracking</div>
          <span className="cell-email">
            {item.collectionReference} · {item.universityName}
          </span>
        </div>
        <span className={`status-badge ${statusClass(item.status)}`}>
          {trackingLabel(item.status)}
        </span>
      </div>
      <PaymentTrackingTimeline status={item.status} />
    </section>
  );
}

function PaymentTrackingTimeline({ status }: { status: string }) {
  const stopped = STOPPED_LABELS[status];
  const activeIndex = Math.max(
    0,
    TRACKING_STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status)),
  );
  return (
    <div className="p-5 sm:p-6">
      {TRACKING_STEPS.map((step, index) => {
        const complete = !stopped && index < activeIndex;
        const current = !stopped && index === activeIndex;
        const reached = complete || current;
        return (
          <div key={step.key} className="grid grid-cols-[32px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                  current
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : complete
                      ? 'border-[var(--success)] bg-[var(--success)] text-white'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink-faint)]'
                }`}
              >
                {complete ? '✓' : index + 1}
              </div>
              {index < TRACKING_STEPS.length - 1 ? (
                <div
                  className={`h-12 w-px ${complete ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`}
                />
              ) : null}
            </div>
            <div className="pb-7">
              <div
                className={`font-semibold ${reached ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}
              >
                {step.label}
              </div>
              <div className="mt-1 text-sm text-[var(--ink-soft)]">
                {current ? 'Current payment location' : complete ? 'Completed' : 'Pending'}
              </div>
            </div>
          </div>
        );
      })}
      {stopped ? (
        <div className="mt-2 rounded-xl border border-[rgba(217,119,6,0.18)] bg-[var(--warning-bg)] p-4 text-sm font-medium text-[var(--warning)]">
          {stopped}
        </div>
      ) : null}
    </div>
  );
}

function PaymentDetailsPanel({ item }: { item: JourneyCase }) {
  const updatedAt =
    item.lastUpdatedAt ?? item.payment?.updatedAt ?? item.instructionCreatedAt ?? item.createdAt;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="p-5 sm:p-6">
        <span className="mono-label">Saved form</span>
        <h2 className="mt-2 text-base font-semibold text-[var(--ink)]">Payment details</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Detail label="Student" value={item.student?.name || 'Not available'} />
          <Detail label="Email" value={item.student?.email || 'Not available'} />
          <Detail label="University" value={item.universityName} />
          <Detail label="Semester" value={item.semesterLabel || 'Semester 1'} />
          <Detail label="Provider" value={item.providerName} />
          <Detail label="Collection reference" value={item.collectionReference} />
          <Detail label="Case ID" value={item.id} />
          <Detail label="Current status" value={trackingLabel(item.status)} />
          <Detail label="Last updated" value={new Date(updatedAt).toLocaleString()} />
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <span className="mono-label">Amount saved</span>
        <h2 className="mt-2 text-base font-semibold text-[var(--ink)]">University receives</h2>
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[rgba(32,32,32,0.015)] p-4">
          <div className="mono-label">Target amount</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">
            {formatMinor(item.targetAmountMinor, item.targetCurrency)}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <AmountRow label="Tuition advance" value={item.feeBreakdown.tuitionAdvanceMinor} />
          <AmountRow label="Course deposit" value={item.feeBreakdown.courseDepositMinor} />
          <AmountRow label="Accommodation" value={item.feeBreakdown.accommodationMinor} />
          <AmountRow label="Other university fees" value={item.feeBreakdown.otherMinor} />
        </div>
      </Card>
      <Card className="p-5 sm:p-6 lg:col-span-2">
        <span className="mono-label">Funding split</span>
        <h2 className="mt-2 text-base font-semibold text-[var(--ink)]">Legs</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {item.fundingLegs.map((leg) => (
            <div
              key={leg.kind}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="text-sm font-semibold text-[var(--ink)]">
                {leg.kind === 'LENDER' ? 'Sanctioned loan disbursement' : 'Student savings'}
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--ink-soft)]">
                  {formatMinor(leg.requiredMinor, 'INR')}
                </span>
                <span
                  className={
                    leg.funded ? 'font-semibold text-[var(--success)]' : 'text-[var(--warning)]'
                  }
                >
                  {leg.funded ? 'Received' : 'Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono-label">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-[var(--ink)]">
        {value.replaceAll('_', ' ')}
      </div>
    </div>
  );
}

function AmountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="font-semibold text-[var(--ink)]">{formatMinor(value, 'INR')}</span>
    </div>
  );
}

function statusClass(status: string): string {
  if (['COMPLETED', 'RECONCILED'].includes(status)) return 'status-success';
  if (Object.prototype.hasOwnProperty.call(STOPPED_LABELS, status)) return 'status-error';
  return 'status-warning';
}

function trackingLabel(status: string): string {
  if (['DRAFT', 'EVIDENCE_SUBMITTED'].includes(status)) return 'Payment initiated';
  if (['INSTRUCTION_ISSUED', 'FUNDING_PENDING'].includes(status)) return 'Awaiting funds';
  if (status === 'FUNDS_RECEIVED') return 'Funds received';
  if (['PAYOUT_SUBMITTED', 'VALIDATING'].includes(status)) return 'Payout submitted';
  if (status === 'TRANSFERRING') return 'Bank transfer in progress';
  if (['COMPLETED', 'RECONCILED'].includes(status)) return 'Delivered to university';
  return STOPPED_LABELS[status] ?? status.replaceAll('_', ' ');
}
