import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Stepper } from '../components/Stepper';
import { Button, Card, ErrorNote, PageHeader, TextInput } from '../components/ui';

export function DocumentsScreen() {
  const caseId = useParams().id ?? '';
  const navigate = useNavigate();
  const [docs, setDocs] = useState<string[]>([
    'KYC passport scan',
    'Loan sanction letter',
    'University invoice',
  ]);
  const [draft, setDraft] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      await api.addDocuments(caseId, docs);
      return api.validate(caseId);
    },
    onSuccess: () => navigate(`/cases/${caseId}/quote`),
  });

  function add(): void {
    const v = draft.trim();
    if (v) {
      setDocs([...docs, v]);
      setDraft('');
    }
  }

  return (
    <div className="space-y-6">
      <Stepper current={2} />
      <PageHeader
        title="Attach documents"
        subtitle="KYC, invoice and sanction references. Only hashes are anchored on-chain — never the documents."
      />
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {docs.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {d}
              <button
                type="button"
                onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-rose-500"
                aria-label={`Remove ${d}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a document reference…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <Button variant="secondary" onClick={add}>
            Add
          </Button>
        </div>
        {submit.error ? <ErrorNote message={(submit.error as ApiError).message} /> : null}
        <Button onClick={() => submit.mutate()} disabled={submit.isPending || docs.length === 0}>
          {submit.isPending ? 'Validating…' : 'Submit & run validation'}
        </Button>
      </Card>
    </div>
  );
}
