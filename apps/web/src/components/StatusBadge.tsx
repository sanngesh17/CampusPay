const COLORS: Record<string, string> = {
  CASE_CREATED: 'bg-slate-100 text-slate-700',
  DOCS_COLLECTED: 'bg-slate-100 text-slate-700',
  VALIDATED: 'bg-sky-100 text-sky-700',
  SUBMITTED_TO_PARTNER: 'bg-sky-100 text-sky-700',
  KYC_VERIFIED: 'bg-sky-100 text-sky-700',
  QUOTE_LOCKED: 'bg-violet-100 text-violet-700',
  FUNDED: 'bg-amber-100 text-amber-700',
  IN_SETTLEMENT: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  RECONCILED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  REFUND_INITIATED: 'bg-rose-100 text-rose-700',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = COLORS[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
