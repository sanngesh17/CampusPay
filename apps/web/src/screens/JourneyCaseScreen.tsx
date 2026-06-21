import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { journeyApi, type JourneyCase } from '../api/journey';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorNote, PageHeader, TextInput } from '../components/ui';
import { formatMinor } from '../lib/format';
import { useState } from 'react';

export function JourneyCaseScreen() {
  const { user } = useAuth();
  const id = useParams().id ?? '';
  const client = useQueryClient();
  const [reference, setReference] = useState('UTR-DEMO-2026-0001');
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['journey-case', id],
    queryFn: () => journeyApi.get(id),
    enabled: !!user && !!id,
    refetchInterval: 2000,
  });
  const action = useMutation({
    mutationFn: async (run: () => Promise<JourneyCase>) => run(),
    onSuccess: async () => {
      setError('');
      await client.invalidateQueries({ queryKey: ['journey-case', id] });
    },
    onError: (cause) => setError((cause as Error).message),
  });
  if (!user) return <Navigate to="/login" replace />;
  const item = query.data;
  async function upload(file?: File) {
    if (file) action.mutate(() => journeyApi.upload(id, file));
  }
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={item?.universityName ?? 'Payment case'}
          subtitle={
            item
              ? `${formatMinor(item.targetAmountMinor, item.targetCurrency)} university payment · ${item.providerName}`
              : 'Loading…'
          }
        />
        {item ? (
          <div className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
            {item.status.replaceAll('_', ' ')}
          </div>
        ) : null}
      </div>
      <ErrorNote message={error || (query.error as Error | null)?.message} />
      {item ? (
        <>
          <Card className="grid gap-4 p-6 md:grid-cols-4">
            <Metric label="Reference" value={item.collectionReference} />
            <Metric label="Compliance" value={item.compliance?.outcome ?? 'Not submitted'} />
            <Metric label="Regulatory route" value={item.compliance?.route ?? 'Pending'} />
            <Metric label="Payout" value={item.payment?.status ?? 'Not initiated'} />
          </Card>
          {item.instructionCreatedAt &&
          Date.now() > new Date(item.instructionCreatedAt).getTime() + 70 * 60 * 60_000 &&
          item.status === 'FUNDING_PENDING' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              This payment instruction is close to expiry. Ask payment operations for a refreshed
              instruction before sending funds.
            </div>
          ) : null}
          {user.role === 'STUDENT' ? (
            <StudentActions item={item} action={action.mutate} upload={upload} />
          ) : null}
          {user.role === 'LENDER_OFFICER' ? (
            <LenderActions
              item={item}
              reference={reference}
              setReference={setReference}
              action={action.mutate}
            />
          ) : null}
          {user.role === 'PAYMENT_OPS' ? (
            <OpsActions
              item={item}
              reference={reference}
              setReference={setReference}
              action={action.mutate}
            />
          ) : null}
          <PrivacyPanel item={item} role={user.role} action={action.mutate} />
          <GrievancePanel item={item} role={user.role} action={action.mutate} />
          <Card className="p-6">
            <h2 className="font-semibold">Funding</h2>
            <div className="mt-4 space-y-3">
              {item.fundingLegs.map((leg) => (
                <div
                  key={leg.kind}
                  className="flex justify-between rounded-xl bg-slate-50 p-4 text-sm"
                >
                  <span>
                    {leg.kind === 'LENDER' ? 'Sanctioned loan disbursement' : 'Student savings'}
                  </span>
                  <span
                    className={leg.funded ? 'font-semibold text-emerald-600' : 'text-amber-600'}
                  >
                    {leg.funded ? 'Received' : `Pending · ${formatMinor(leg.requiredMinor, 'INR')}`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold">Audit timeline</h2>
            <div className="mt-4 space-y-4">
              {[...item.audit].reverse().map((entry, index) => (
                <div
                  key={`${entry.event}-${index}`}
                  className="flex gap-4 border-l-2 border-brand-100 pl-4"
                >
                  <div>
                    <div className="text-sm font-medium">{entry.event.replaceAll('_', ' ')}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(entry.at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-800">{value.replaceAll('_', ' ')}</div>
    </div>
  );
}
type Mutate = (run: () => Promise<JourneyCase>) => void;
function StudentActions({
  item,
  action,
  upload,
}: {
  item: JourneyCase;
  action: Mutate;
  upload(file?: File): Promise<void>;
}) {
  const editing = item.status === 'DRAFT' || item.status === 'CHANGES_REQUESTED';
  return (
    <Card className="space-y-4 p-6">
      <h2 className="font-semibold">Student actions</h2>
      {editing ? (
        <>
          <label className="block rounded-xl border-2 border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
            Upload updated passport, sanction letter, or invoice
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="mt-3 block w-full text-xs"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          <div className="text-sm text-slate-500">
            {item.documents.length} evidence file(s) securely uploaded.
          </div>
          <Button
            onClick={() => action(() => journeyApi.submit(item.id))}
            disabled={item.documents.length === 0}
          >
            Accept declarations and submit
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void journeyApi.downloadInstruction(item.id)}>
            Download payment request
          </Button>
          {item.status === 'RECONCILED' ? (
            <Button onClick={() => void journeyApi.downloadReceipt(item.id)}>
              Download final receipt
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
function LenderActions({
  item,
  reference,
  setReference,
  action,
}: {
  item: JourneyCase;
  reference: string;
  setReference(value: string): void;
  action: Mutate;
}) {
  const lenderLeg = item.fundingLegs.find((leg) => leg.kind === 'LENDER');
  return (
    <Card className="space-y-4 p-6">
      <h2 className="font-semibold">Lender disbursement review</h2>
      <p className="text-sm text-slate-500">
        This approves disbursement from an already sanctioned education loan. It is not loan
        underwriting.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {item.documents.map((document) => (
          <button
            key={document.id}
            className="rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
            onClick={() => void journeyApi.downloadDocument(item.id, document.id, document.name)}
          >
            <span className="block font-medium">{document.name}</span>
            <span className="mt-1 block text-xs text-slate-400">Verified SHA-256 · download</span>
          </button>
        ))}
      </div>
      <Button variant="secondary" onClick={() => void journeyApi.downloadInstruction(item.id)}>
        Download instruction
      </Button>
      {!item.lenderApproved ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => action(() => journeyApi.lenderDecision(item.id, 'APPROVE'))}>
            Approve disbursement
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              action(() =>
                journeyApi.lenderDecision(item.id, 'CHANGES', 'Updated loan evidence required'),
              )
            }
          >
            Request changes
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              action(() => journeyApi.lenderDecision(item.id, 'REJECT', 'Rejected by lender'))
            }
          >
            Reject
          </Button>
        </div>
      ) : null}
      {item.lenderApproved && lenderLeg && !lenderLeg.funded ? (
        <div className="flex gap-3">
          <TextInput value={reference} onChange={(e) => setReference(e.target.value)} />
          <Button onClick={() => action(() => journeyApi.lenderFunding(item.id, reference))}>
            Record UTR and transfer date
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
function OpsActions({
  item,
  reference,
  setReference,
  action,
}: {
  item: JourneyCase;
  reference: string;
  setReference(value: string): void;
  action: Mutate;
}) {
  const studentLeg = item.fundingLegs.find((leg) => leg.kind === 'STUDENT');
  const active = item.payment && !['COMPLETED', 'RECONCILED', 'FAILED'].includes(item.status);
  return (
    <Card className="space-y-4 p-6">
      <h2 className="font-semibold">Payment operations</h2>
      {studentLeg && !studentLeg.funded ? (
        <div className="flex gap-3">
          <TextInput value={reference} onChange={(e) => setReference(e.target.value)} />
          <Button
            onClick={() => action(() => journeyApi.opsFunding(item.id, 'STUDENT', reference))}
          >
            Verify student funds
          </Button>
        </div>
      ) : null}
      {item.status === 'FUNDS_RECEIVED' && !item.quote ? (
        <Button onClick={() => action(() => journeyApi.quote(item.id))}>Request final quote</Button>
      ) : null}
      {item.quote && !item.payment ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div>FX rate: {item.quote.fxRate}</div>
          <div>Target: {formatMinor(item.quote.targetAmountMinor, item.quote.targetCurrency)}</div>
          <Button onClick={() => action(() => journeyApi.payout(item.id))}>
            Submit simulated payout
          </Button>
        </div>
      ) : null}
      {active ? (
        <div className="flex gap-3">
          <Button onClick={() => action(() => journeyApi.advance(item.id))}>
            Advance partner status
          </Button>
          <Button variant="secondary" onClick={() => action(() => journeyApi.fail(item.id))}>
            Simulate failure
          </Button>
        </div>
      ) : null}
      {item.status === 'COMPLETED' ? (
        <Button onClick={() => action(() => journeyApi.reconcile(item.id))}>
          Reconcile payment
        </Button>
      ) : null}
    </Card>
  );
}
function GrievancePanel({
  item,
  role,
  action,
}: {
  item: JourneyCase;
  role: string;
  action: Mutate;
}) {
  const [message, setMessage] = useState('');
  if (role === 'LENDER_OFFICER' && item.grievances.length === 0) return null;
  return (
    <Card className="space-y-4 p-6">
      <h2 className="font-semibold">Help and grievances</h2>
      {item.grievances.map((grievance) => (
        <div
          key={grievance.id}
          className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-4 text-sm"
        >
          <div>
            <div className="font-medium">
              {grievance.category} · {grievance.status}
            </div>
            <div className="mt-1 text-slate-500">{grievance.message}</div>
          </div>
          {role === 'PAYMENT_OPS' && grievance.status === 'OPEN' ? (
            <Button
              variant="secondary"
              onClick={() => action(() => journeyApi.resolveGrievance(item.id, grievance.id))}
            >
              Resolve
            </Button>
          ) : null}
        </div>
      ))}
      {role === 'STUDENT' ? (
        <div className="flex gap-3">
          <TextInput
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe your payment issue"
          />
          <Button
            onClick={() => {
              action(() => journeyApi.grievance(item.id, 'PAYMENT_SUPPORT', message));
              setMessage('');
            }}
            disabled={message.trim().length < 10}
          >
            Raise issue
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
function PrivacyPanel({ item, role, action }: { item: JourneyCase; role: string; action: Mutate }) {
  const [details, setDetails] = useState(
    'Please process this data rights request for my payment case.',
  );
  const [type, setType] = useState<'ACCESS' | 'CORRECTION' | 'ERASURE' | 'CONSENT_WITHDRAWAL'>(
    'ACCESS',
  );
  if (role === 'LENDER_OFFICER') return null;
  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Privacy and data rights</h2>
          <p className="mt-1 text-sm text-slate-500">
            Requests, consent versions, retention and legal holds are recorded in the audit trail.
          </p>
        </div>
        {item.legalHold?.active ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Legal hold active
          </span>
        ) : null}
      </div>
      {item.privacyRequests.map((request) => (
        <div key={request.id} className="rounded-xl bg-slate-50 p-4 text-sm">
          <div className="font-medium">
            {request.type.replaceAll('_', ' ')} · {request.status}
          </div>
          <div className="mt-1 text-slate-500">{request.outcome ?? request.details}</div>
          {role === 'PAYMENT_OPS' && request.status === 'OPEN' ? (
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  action(() =>
                    journeyApi.resolvePrivacyRequest(
                      item.id,
                      request.id,
                      'COMPLETED',
                      'Request completed after identity and legal-basis checks.',
                    ),
                  )
                }
              >
                Complete
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  action(() =>
                    journeyApi.resolvePrivacyRequest(
                      item.id,
                      request.id,
                      'DECLINED',
                      'Request declined because regulated transaction records must be retained.',
                    ),
                  )
                }
              >
                Decline
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {role === 'STUDENT' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ACCESS">Data access</option>
              <option value="CORRECTION">Correction</option>
              <option value="ERASURE">Erasure</option>
              <option value="CONSENT_WITHDRAWAL">Withdraw consent</option>
            </select>
            <TextInput value={details} onChange={(event) => setDetails(event.target.value)} />
            <Button
              onClick={() => action(() => journeyApi.privacyRequest(item.id, type, details))}
              disabled={details.trim().length < 10}
            >
              Submit request
            </Button>
          </div>
          <Button variant="secondary" onClick={() => void journeyApi.downloadPersonalData(item.id)}>
            Download my data
          </Button>
        </>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              action(() =>
                journeyApi.legalHold(
                  item.id,
                  !item.legalHold?.active,
                  item.legalHold?.active
                    ? 'Regulatory retention review completed'
                    : 'Regulatory transaction record preservation',
                ),
              )
            }
          >
            {item.legalHold?.active ? 'Release legal hold' : 'Place legal hold'}
          </Button>
        </div>
      )}
    </Card>
  );
}
