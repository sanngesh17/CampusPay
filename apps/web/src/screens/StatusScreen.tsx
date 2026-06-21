import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Stepper } from '../components/Stepper';
import { Timeline } from '../components/Timeline';
import { Button, Card, ErrorNote, PageHeader } from '../components/ui';
import { TERMINAL_STATUSES } from '../lib/constants';
import { shortHash } from '../lib/format';

export function StatusScreen() {
  const caseId = useParams().id ?? '';
  const caseQuery = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId),
    enabled: caseId !== '',
    refetchInterval: 1500,
  });
  const attQuery = useQuery({
    queryKey: ['attestations', caseId],
    queryFn: () => api.listAttestations(caseId),
    enabled: caseId !== '',
    refetchInterval: 2000,
  });
  const settle = useMutation({
    mutationFn: () => api.settle(caseId),
    onSuccess: () => {
      void caseQuery.refetch();
      void attQuery.refetch();
    },
  });

  const c = caseQuery.data;
  const done = c ? TERMINAL_STATUSES.has(c.status) : false;
  const canSettle = c?.status === 'IN_SETTLEMENT' || c?.status === 'FUNDED';
  const attestations = attQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Stepper current={4} />
      <div className="flex items-center justify-between">
        <PageHeader title="Payment status" subtitle={c ? `Case ${c.id.slice(0, 8)}…` : undefined} />
        {c ? <StatusBadge status={c.status} /> : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-5 p-6">
          <Timeline entries={c?.timeline ?? []} />
          {canSettle ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-medium text-amber-800">Awaiting partner settlement</div>
              <p className="mt-1 text-xs text-amber-700">
                In production the partner posts an HMAC-signed webhook. Simulate it for the demo:
              </p>
              {settle.error ? <ErrorNote message={(settle.error as ApiError).message} /> : null}
              <Button className="mt-3" onClick={() => settle.mutate()} disabled={settle.isPending}>
                {settle.isPending ? 'Settling…' : 'Confirm settlement (demo)'}
              </Button>
            </div>
          ) : null}
          {done && c?.status === 'RECONCILED' ? (
            <Link to={`/cases/${caseId}/receipt`}>
              <Button>View receipt →</Button>
            </Link>
          ) : null}
        </Card>
        <Card className="h-fit space-y-3 p-6">
          <div className="text-sm font-semibold text-slate-800">On-chain attestations</div>
          <p className="text-xs text-slate-400">Milestone hashes anchored on XRPL — no PII.</p>
          <ul className="space-y-2">
            {attestations.map((a) => (
              <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="font-medium text-slate-700">{a.milestone.replace(/_/g, ' ')}</div>
                <div className="font-mono text-[11px] text-slate-400">{shortHash(a.txHash)}</div>
              </li>
            ))}
            {attestations.length === 0 ? (
              <li className="text-xs text-slate-400">None yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
