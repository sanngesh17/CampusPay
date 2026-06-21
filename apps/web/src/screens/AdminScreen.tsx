import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Card, PageHeader } from '../components/ui';
import { formatMinor } from '../lib/format';

export function AdminScreen() {
  const cases = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.listCases(),
    refetchInterval: 3000,
  });
  const rows = cases.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="All cases and their on-chain attestation status." />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Case</th>
              <th className="px-5 py-3 font-medium">Beneficiary</th>
              <th className="px-5 py-3 font-medium">Mode</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Attestations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link
                    to={`/cases/${c.id}/status`}
                    className="font-mono text-xs text-brand-600 hover:underline"
                  >
                    {c.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-700">{c.beneficiary}</td>
                <td className="px-5 py-3 text-slate-500">{c.mode}</td>
                <td className="px-5 py-3 text-slate-700">
                  {formatMinor(c.amount.minor, c.amount.currency)}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-5 py-3 text-slate-600">
                  <span className="font-semibold">{c.attestationCount}</span> on-chain
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  No cases yet. Create one to begin.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
