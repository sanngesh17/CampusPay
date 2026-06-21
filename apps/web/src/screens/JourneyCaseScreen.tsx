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
    <div className="space-y-5">
      <ErrorNote message={(queryError as Error | null)?.message} />
      {item ? (
        <>
          <PaymentTrackingPanel item={item} />
          <PaymentDetailsPanel item={item} />
        </>
      ) : (
        <Card className="p-8 text-center text-slate-400">Loading payment tracking...</Card>
      )}
    </div>
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
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Payment tracking</h1>
            <p className="mt-1 text-sm text-slate-500">
              {item.collectionReference} · {item.universityName}
            </p>
          </div>
          <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {trackingLabel(item.status)}
          </span>
        </div>
      </div>
      <PaymentTrackingTimeline status={item.status} />
    </Card>
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
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : complete
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-300'
                }`}
              >
                {complete ? '✓' : index + 1}
              </div>
              {index < TRACKING_STEPS.length - 1 ? (
                <div className={`h-12 w-px ${complete ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              ) : null}
            </div>
            <div className="pb-7">
              <div className={`font-semibold ${reached ? 'text-slate-900' : 'text-slate-400'}`}>
                {step.label}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {current ? 'Current payment location' : complete ? 'Completed' : 'Pending'}
              </div>
            </div>
          </div>
        );
      })}
      {stopped ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
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
        <h2 className="text-base font-semibold text-slate-950">Payment details</h2>
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
        <h2 className="text-base font-semibold text-slate-950">Amount saved</h2>
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            University receives
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">
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
        <h2 className="text-base font-semibold text-slate-950">Funding split</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {item.fundingLegs.map((leg) => (
            <div key={leg.kind} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">
                {leg.kind === 'LENDER' ? 'Sanctioned loan disbursement' : 'Student savings'}
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">{formatMinor(leg.requiredMinor, 'INR')}</span>
                <span className={leg.funded ? 'font-semibold text-emerald-600' : 'text-amber-600'}>
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
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">
        {value.replaceAll('_', ' ')}
      </div>
    </div>
  );
}

function AmountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{formatMinor(value, 'INR')}</span>
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
  return STOPPED_LABELS[status] ?? status.replaceAll('_', ' ');
}
