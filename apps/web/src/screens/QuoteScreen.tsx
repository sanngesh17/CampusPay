import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Stepper } from '../components/Stepper';
import { Button, Card, ErrorNote, PageHeader } from '../components/ui';
import { countdown, formatMinor } from '../lib/format';

function QRow({ k, v, bold, accent }: { k: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={bold ? 'font-semibold text-slate-800' : 'text-slate-500'}>{k}</span>
      <span
        className={`tabular-nums ${bold ? 'text-base font-semibold text-slate-900' : accent ? 'font-medium text-emerald-600' : 'font-medium text-slate-800'}`}
      >
        {v}
        {accent ? ' · 0%' : ''}
      </span>
    </div>
  );
}

function CountdownPill({ iso, now }: { iso: string; now: number }) {
  const text = countdown(iso, now);
  const expired = text === 'expired';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${expired ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}
    >
      <span className="text-[8px]">●</span> {expired ? 'Quote expired' : `Expires in ${text}`}
    </span>
  );
}

export function QuoteScreen() {
  const caseId = useParams().id ?? '';
  const navigate = useNavigate();
  const caseQuery = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId),
    enabled: caseId !== '',
  });
  const lock = useMutation({
    mutationFn: () => api.quote(caseId),
    onSuccess: () => caseQuery.refetch(),
  });
  const initiate = useMutation({
    mutationFn: () => api.initiate(caseId),
    onSuccess: () => navigate(`/cases/${caseId}/status`),
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const c = caseQuery.data;
  const quote = c?.quote;

  return (
    <div className="space-y-6">
      <Stepper current={3} />
      <PageHeader
        title="Review your quote"
        subtitle="Locked FX, fees and TCS. Loan-funded education is 0% TCS."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          {!quote ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Lock a live quote via the rail router (selects Rail A for amounts ≤ ₹25,00,000).
              </p>
              {lock.error ? <ErrorNote message={(lock.error as ApiError).message} /> : null}
              <Button onClick={() => lock.mutate()} disabled={lock.isPending || !c}>
                {lock.isPending ? 'Locking…' : 'Lock quote'}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-500">{quote.fxRate}</div>
                <CountdownPill iso={quote.expiresAt} now={now} />
              </div>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                <QRow k="Principal" v={formatMinor(quote.principalMinor, quote.currency)} />
                <QRow k="Fees" v={formatMinor(quote.feesMinor, quote.currency)} />
                <QRow
                  k="TCS"
                  v={formatMinor(quote.tcsMinor, quote.currency)}
                  accent={quote.tcsMinor === '0'}
                />
                <QRow
                  k="Total payable"
                  v={formatMinor(quote.finalPayableMinor, quote.currency)}
                  bold
                />
              </div>
              {initiate.error ? <ErrorNote message={(initiate.error as ApiError).message} /> : null}
              <Button
                className="w-full"
                onClick={() => initiate.mutate()}
                disabled={initiate.isPending}
              >
                {initiate.isPending ? 'Initiating…' : 'Confirm & pay'}
              </Button>
            </div>
          )}
        </Card>
        <Card className="h-fit space-y-2 p-6 text-sm text-slate-500">
          <div className="font-semibold text-slate-800">How this is priced</div>
          <p>
            FX, fees and TCS come from config, not code. Loan-funded education maps to the 0%-TCS
            purpose.
          </p>
          <p>The quote is locked for 15 minutes and anchored on-chain as a hash at QUOTE_LOCKED.</p>
        </Card>
      </div>
    </div>
  );
}
