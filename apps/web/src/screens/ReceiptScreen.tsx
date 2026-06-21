import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Button, Card, ErrorNote, PageHeader } from '../components/ui';
import { formatMinor, shortHash } from '../lib/format';

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-mono text-xs text-slate-700">{v}</span>
    </div>
  );
}

export function ReceiptScreen() {
  const caseId = useParams().id ?? '';
  const receipt = useQuery({
    queryKey: ['receipt', caseId],
    queryFn: () => api.getReceipt(caseId),
    enabled: caseId !== '',
  });
  const r = receipt.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proof of payment"
        subtitle="The receipt hash is anchored on-chain at PAID."
      />
      <Card className="max-w-lg p-6">
        {receipt.isLoading ? <p className="text-sm text-slate-400">Loading…</p> : null}
        {receipt.error ? <ErrorNote message={(receipt.error as ApiError).message} /> : null}
        {r ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-600">
                ✓
              </span>
              <div>
                <div className="font-semibold text-slate-800">
                  {formatMinor(r.amountPaid.minor, r.amountPaid.currency)} paid
                </div>
                <div className="text-sm text-slate-500">
                  Rail {r.rail} · {r.status}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <Row k="Payment ID" v={r.paymentId} />
              <Row k="Proof hash" v={shortHash(r.proofHash)} />
            </div>
            <Link to="/admin">
              <Button variant="secondary">Go to admin</Button>
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
