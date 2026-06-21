import type { TimelineEntry } from '../api/types';
import { formatTime } from '../lib/format';

const LABELS: Record<string, string> = {
  CaseCreated: 'Case created',
  DocumentsAttached: 'Documents attached',
  DocsCollected: 'Documents collected',
  CaseValidated: 'Validated (beneficiary + sanctions)',
  QuoteLocked: 'Quote locked',
  CaseFunded: 'Funded by lender',
  PaymentSettled: 'Payment settled',
  CaseReconciled: 'Reconciled',
  CaseFailed: 'Failed',
};

function humanize(event: string): string {
  return LABELS[event] ?? event;
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No events yet.</p>;
  }
  return (
    <ol className="relative ml-1 space-y-4 border-l border-slate-200 pl-6">
      {entries.map((e, i) => (
        <li key={`${e.event}-${i}`} className="relative">
          <span className="absolute -left-[1.7rem] top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-100" />
          <div className="text-sm font-medium text-slate-800">{humanize(e.event)}</div>
          <div className="text-xs text-slate-400">
            {formatTime(e.at)}
            {e.detail ? ` · ${e.detail}` : ''}
          </div>
        </li>
      ))}
    </ol>
  );
}
