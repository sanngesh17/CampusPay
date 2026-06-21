import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { journeyApi } from '../api/journey';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, PageHeader } from '../components/ui';
import { formatMinor } from '../lib/format';
import { useState } from 'react';

export function JourneyDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const cases = useQuery({
    queryKey: ['journey-cases', user?.id],
    queryFn: () => journeyApi.list(user!),
    enabled: !!user,
    refetchInterval: 2500,
  });
  if (!user) return <Navigate to="/login" replace />;
  const roleCopy =
    user.role === 'STUDENT'
      ? 'Your tuition payments and live partner status.'
      : user.role === 'LENDER_OFFICER'
        ? 'Sanctioned-loan disbursements assigned to your institution.'
        : 'Compliance, funding, payout and reconciliation queue.';
  const visible = (cases.data ?? []).filter((item) =>
    `${item.id} ${item.universityName} ${item.collectionReference} ${item.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={`${user.displayName} dashboard`} subtitle={roleCopy} />
        {user.role === 'STUDENT' ? (
          <Link to="/payments/new">
            <Button>New payment</Button>
          </Link>
        ) : null}
      </div>
      {user.role !== 'STUDENT' ? (
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search case, reference, university or status"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      ) : null}
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
        {cases.isLoading ? (
          <Card className="p-8 text-center text-slate-400">Loading cases…</Card>
        ) : null}
        {!cases.isLoading && visible.length === 0 ? (
          <Card className="p-10 text-center text-slate-400">No cases match this queue.</Card>
        ) : null}
      </div>
    </div>
  );
}
