import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Stepper } from '../components/Stepper';
import { Button, Card, ErrorNote, Field, PageHeader, Select, TextInput } from '../components/ui';
import { BENEFICIARIES, LENDERS, STUDENTS } from '../lib/constants';
import { formatMinor } from '../lib/format';

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-800">{v}</span>
    </div>
  );
}

export function CreateCaseScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const studentId = params.get('student') ?? 'student-a';
  const persona = STUDENTS.find((s) => s.id === studentId);

  const [lenderId, setLenderId] = useState('lender-sbi');
  const [beneficiaryId, setBeneficiaryId] = useState('uni-oxford');
  const [rupees, setRupees] = useState('1000000');
  const [mode, setMode] = useState<'INTEGRATED' | 'DIRECT'>('INTEGRATED');
  const [funding, setFunding] = useState<'LOAN' | 'SELF'>('LOAN');
  const [reference, setReference] = useState('');

  const beneficiary = BENEFICIARIES.find((b) => b.id === beneficiaryId);
  const amountValue = Number(rupees);
  const amountMinor =
    Number.isFinite(amountValue) && amountValue > 0 ? String(Math.round(amountValue * 100)) : '0';

  const create = useMutation({
    mutationFn: () =>
      api.createCase({
        studentId,
        lenderId,
        beneficiaryId,
        amountMinor,
        currency: 'INR',
        mode,
        funding,
        reference: reference.trim() ? reference.trim() : undefined,
      }),
    onSuccess: (c) => navigate(`/cases/${c.id}/documents`),
  });

  return (
    <div className="space-y-6">
      <Stepper current={1} />
      <PageHeader
        title="Create a tuition payment"
        subtitle={persona ? `For ${persona.name} · KYC verified` : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-4 p-6">
          <Field label="Lender">
            <Select value={lenderId} onChange={(e) => setLenderId(e.target.value)}>
              {LENDERS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="University (beneficiary)">
            <Select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)}>
              {BENEFICIARIES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (₹)" hint="Rail A handles up to ₹25,00,000">
            <TextInput
              inputMode="decimal"
              value={rupees}
              onChange={(e) => setRupees(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mode">
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'INTEGRATED' | 'DIRECT')}
              >
                <option value="INTEGRATED">Integrated</option>
                <option value="DIRECT">Direct</option>
              </Select>
            </Field>
            <Field label="Funding">
              <Select
                value={funding}
                onChange={(e) => setFunding(e.target.value as 'LOAN' | 'SELF')}
              >
                <option value="LOAN">Loan-funded</option>
                <option value="SELF">Self-funded</option>
              </Select>
            </Field>
          </div>
          <Field
            label="Payment reference (optional)"
            hint={beneficiary ? `e.g. ${beneficiary.referenceHint}` : undefined}
          >
            <TextInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={beneficiary?.referenceHint}
            />
          </Field>
          {create.error ? <ErrorNote message={(create.error as ApiError).message} /> : null}
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || amountMinor === '0'}
          >
            {create.isPending ? 'Creating…' : 'Continue to documents'}
          </Button>
        </Card>
        <Card className="h-fit space-y-3 p-6 text-sm">
          <div className="font-semibold text-slate-800">Summary</div>
          <Row k="Student" v={persona?.name ?? studentId} />
          <Row k="Corridor" v={`INR → ${beneficiary?.currency ?? '—'}`} />
          <Row k="Amount" v={formatMinor(amountMinor, 'INR')} />
          <Row k="Mode" v={mode} />
          <Row k="Funding" v={funding === 'LOAN' ? 'Loan (0% TCS)' : 'Self (5% TCS)'} />
        </Card>
      </div>
    </div>
  );
}
