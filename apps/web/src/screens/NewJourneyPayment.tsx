import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { journeyApi } from '../api/journey';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorNote, Field, Select, TextInput } from '../components/ui';

const PROVIDERS = [
  {
    name: 'State Bank of India',
    id: 'lender-sbi',
    kind: 'BANK' as const,
    mark: 'SBI',
    color: 'bg-blue-700',
  },
  {
    name: 'HDFC Bank',
    id: 'lender-hdfc',
    kind: 'BANK' as const,
    mark: 'HDFC',
    color: 'bg-red-600',
  },
  {
    name: 'Kotak Mahindra Bank',
    id: 'lender-kotak',
    kind: 'BANK' as const,
    mark: 'KOTAK',
    color: 'bg-rose-700',
  },
  {
    name: 'HDFC Credila',
    id: 'lender-credila',
    kind: 'NBFC' as const,
    mark: 'CREDILA',
    color: 'bg-indigo-600',
  },
  {
    name: 'Avanse Financial Services',
    id: 'lender-avanse',
    kind: 'NBFC' as const,
    mark: 'AVANSE',
    color: 'bg-cyan-700',
  },
] as const;

const SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
] as const;

const STEP_LABELS = ['University', 'Payment', 'Funding', 'Provider', 'Details'];

interface Fees {
  tuition: string;
  deposit: string;
  accommodation: string;
  other: string;
}

const FEE_FIELDS: Array<[keyof Fees, string]> = [
  ['tuition', 'Tuition fee - payment in advance'],
  ['deposit', 'Tuition fee - course deposit'],
  ['accommodation', 'Accommodation fee'],
  ['other', 'Other university fees'],
];

interface Details {
  email: string;
  firstName: string;
  middleName: string;
  familyName: string;
  pinCode: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  phone: string;
  branch: string;
  loanAccount: string;
  sanctionReference: string;
  payerName: string;
  relationship: string;
  pan: string;
}

export function NewJourneyPayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();

  const [step, setStep] = useState(1);
  const [semesterLabel, setSemesterLabel] = useState<(typeof SEMESTERS)[number]>('Semester 1');
  const [fees, setFees] = useState<Fees>({
    tuition: '',
    deposit: '',
    accommodation: '',
    other: '',
  });
  const [providerId, setProviderId] = useState('');
  const [evidence, setEvidence] = useState<File>();
  const [accepted, setAccepted] = useState(false);
  const [details, setDetails] = useState<Details>({
    email: user?.email ?? '',
    firstName: 'Aarav',
    middleName: '',
    familyName: 'Sharma',
    pinCode: '560001',
    address1: '12 Residency Road',
    address2: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    phone: '9876543210',
    branch: 'SBI RACPC Bengaluru',
    loanAccount: 'EDU-2026-001234',
    sanctionReference: 'SANCTION-2026-44',
    payerName: 'Raj Sharma',
    relationship: 'Parent',
    pan: 'ABCDE1234F',
  });

  const selectedProvider = PROVIDERS.find((item) => item.id === providerId);
  const universityName = user?.universityName ?? 'University of Warwick';
  const totalMinor = useMemo(
    () => Object.values(fees).reduce((sum, value) => sum + parseMinor(value), 0n),
    [fees],
  );
  const sourceMinor = (totalMinor * 1_275_204n) / 10_000n;
  const showSummary = totalMinor > 0n;

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedProvider || !evidence) {
        throw new Error('Select a provider and attach the loan sanction letter');
      }

      const created = await journeyApi.create({
        fundingType: 'FULL_LOAN',
        amountMinor: sourceMinor.toString(),
        lenderAmountMinor: sourceMinor.toString(),
        lenderId: selectedProvider.id,
        lenderName: selectedProvider.name,
        providerName: selectedProvider.name,
        providerType: selectedProvider.kind,
        semesterLabel,
        branchName: details.branch,
        loanAccountNumber: details.loanAccount,
        sanctionReference: details.sanctionReference,
        universityName,
        destinationCountry: 'United Kingdom',
        targetCurrency: 'GBP',
        targetAmountMinor: totalMinor.toString(),
        feeBreakdown: {
          tuitionAdvanceMinor: parseMinor(fees.tuition).toString(),
          courseDepositMinor: parseMinor(fees.deposit).toString(),
          accommodationMinor: parseMinor(fees.accommodation).toString(),
          otherMinor: parseMinor(fees.other).toString(),
        },
        studentEmail: details.email,
        firstName: details.firstName,
        middleName: details.middleName,
        familyName: details.familyName,
        pinCode: details.pinCode,
        addressLine1: details.address1,
        addressLine2: details.address2,
        city: details.city,
        state: details.state,
        phone: details.phone,
        payerName: details.payerName,
        payerRelationship: details.relationship,
        payerPan: details.pan.toUpperCase(),
      });

      await journeyApi.upload(created.id, evidence);
      await journeyApi.submit(created.id);
      return created.id;
    },
    onSuccess: async (id) => {
      await client.invalidateQueries({ queryKey: ['journey-cases', user?.id] });
      navigate(`/payments/${id}`);
    },
  });

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'STUDENT') return <Navigate to="/dashboard" replace />;

  const canContinue =
    step === 1
      ? true
      : step === 2
        ? totalMinor > 0n
        : step === 3
          ? true
          : step === 4
            ? providerId !== ''
            : requiredDetails(details) && !!evidence && accepted;

  return (
    <>
      <WizardHeader step={step} />
      <div className={`grid gap-5 ${showSummary ? 'lg:grid-cols-[1fr_300px]' : ''}`}>
        <Card className="overflow-visible">
          <div className="p-6 md:p-9">
            {step === 1 ? (
              <UniversityStep
                universityName={universityName}
                semesterLabel={semesterLabel}
                setSemesterLabel={setSemesterLabel}
              />
            ) : null}
            {step === 2 ? <PaymentStep fees={fees} setFees={setFees} total={totalMinor} /> : null}
            {step === 3 ? <FundingStep /> : null}
            {step === 4 ? <ProviderStep value={providerId} onChange={setProviderId} /> : null}
            {step === 5 ? (
              <DetailsStep
                value={details}
                onChange={setDetails}
                evidence={evidence}
                setEvidence={setEvidence}
                accepted={accepted}
                setAccepted={setAccepted}
              />
            ) : null}

            <ErrorNote message={create.error ? (create.error as Error).message : undefined} />

            <div className="mt-8 flex items-center justify-between border-t pt-6 divider">
              <Button
                variant="ghost"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                Back
              </Button>

              {step < 5 ? (
                <Button
                  data-testid="wizard-next"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={!canContinue}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  data-testid="wizard-submit"
                  onClick={() => create.mutate()}
                  disabled={!canContinue || create.isPending}
                >
                  {create.isPending ? 'Generating request…' : 'Generate payment request'}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {showSummary ? (
          <PaymentSummary
            institution={universityName}
            semesterLabel={semesterLabel}
            totalMinor={totalMinor}
            sourceMinor={sourceMinor}
            provider={selectedProvider?.name}
          />
        ) : null}
      </div>
    </>
  );
}

function WizardHeader({ step }: { step: number }) {
  return (
    <header className="dashboard-header">
      <span className="eyebrow">Make a payment</span>
      <h1>
        Generate tuition, <span>semester scoped.</span>
      </h1>
      <p>One saved payment request per university semester.</p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {STEP_LABELS.map((label, index) => (
          <div key={label}>
            <div
              className={`h-1.5 rounded-full ${
                index + 1 <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            />
            <div
              className={`mt-2 hidden font-mono text-[11px] md:block ${
                index + 1 === step ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]'
              }`}
            >
              {index + 1}. {label}
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="mb-7">
      <div className="mono-label">{eyebrow}</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)] md:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">{copy}</p>
    </div>
  );
}

function UniversityStep({
  universityName,
  semesterLabel,
  setSemesterLabel,
}: {
  universityName: string;
  semesterLabel: string;
  setSemesterLabel(value: (typeof SEMESTERS)[number]): void;
}) {
  const [semesterOpen, setSemesterOpen] = useState(false);
  return (
    <>
      <SectionTitle
        eyebrow="Destination"
        title="Your university payment"
        copy="This student login is linked to one university. Choose the semester this payment belongs to."
      />
      <Field label="Institution country">
        <Select value="United Kingdom" disabled>
          <option>United Kingdom</option>
        </Select>
      </Field>
      <div className="my-5 rounded-xl bg-[rgba(32,32,32,0.025)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mono-label">Institution</div>
            <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{universityName}</div>
          </div>
          <span className="status-badge status-warning">Locked</span>
        </div>
      </div>
      <Field label="Semester">
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={semesterOpen}
            className="tf-input flex items-center justify-between text-left"
            onClick={() => setSemesterOpen((current) => !current)}
          >
            <span>{semesterLabel}</span>
            <span className="font-mono text-[11px] text-[var(--ink-faint)]">⌄</span>
          </button>
          {semesterOpen ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-[100] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_14px_32px_rgba(32,32,32,0.10)]"
            >
              {SEMESTERS.map((semester) => (
                <button
                  key={semester}
                  type="button"
                  role="option"
                  aria-selected={semester === semesterLabel}
                  className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                    semester === semesterLabel
                      ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                      : 'text-[var(--ink)] hover:bg-[rgba(32,32,32,0.03)]'
                  }`}
                  onClick={() => {
                    setSemesterLabel(semester);
                    setSemesterOpen(false);
                  }}
                >
                  <span>{semester}</span>
                  {semester === semesterLabel ? (
                    <span className="font-mono text-[11px]">selected</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Field>
    </>
  );
}

function PaymentStep({
  fees,
  setFees,
  total,
}: {
  fees: Fees;
  setFees(value: Fees): void;
  total: bigint;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="Payment details"
        title="What would you like to pay?"
        copy="Enter one or more amounts in British pounds. Leave fields blank when they do not apply."
      />
      <div className="space-y-3">
        {FEE_FIELDS.map(([key, label]) => (
          <label
            key={key}
            className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] focus-within:border-[var(--accent)]"
          >
            <span className="border-r border-[var(--border)] px-4 py-4 font-semibold text-[var(--ink-soft)]">
              £
            </span>
            <span className="flex-1 px-4">
              <span className="block text-xs text-[var(--ink-soft)]">{label}</span>
              <input
                className="mt-1 w-full border-0 bg-transparent text-lg font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] placeholder:font-medium"
                inputMode="decimal"
                value={fees[key]}
                onChange={(event) =>
                  setFees({ ...fees, [key]: event.target.value.replace(/[^0-9.]/g, '') })
                }
                placeholder="0.00"
              />
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-[var(--ink)] px-6 py-5 text-[var(--bg)]">
        <span className="text-sm text-[var(--border)]">University receives</span>
        <span className="text-2xl font-semibold">{formatCurrency(total, 'GBP')}</span>
      </div>

      <Field label="The payment will come from">
        <Select value="India" disabled>
          <option>India</option>
        </Select>
      </Field>
    </>
  );
}

function FundingStep() {
  return (
    <>
      <SectionTitle
        eyebrow="Source of funds"
        title="How is this payment funded?"
        copy="The first release supports disbursement from an existing, fully sanctioned education loan."
      />
      <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-bg)] p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-xl text-white">
          ₹
        </div>
        <h2 className="mt-5 text-xl font-semibold text-[var(--ink)]">Full loan financing</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--ink-soft)]">
          Your approved loan provider funds the full payment. TuitionFlow does not originate,
          underwrite, or sanction the loan.
        </p>
        <div className="status-badge status-success mt-5">Available</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {['Partial loan + savings', 'Self-funded', 'Cards / other'].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-dashed border-[var(--border)] bg-[rgba(32,32,32,0.012)] p-4 text-center text-xs text-[var(--ink-faint)]"
          >
            {label}
            <div className="mt-2 font-semibold text-[var(--ink-faint)]">Coming later</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ProviderStep({ value, onChange }: { value: string; onChange(value: string): void }) {
  return (
    <>
      <SectionTitle
        eyebrow="Loan provider"
        title="Who sanctioned your education loan?"
        copy="Select the bank or NBFC that will review and release the approved disbursement."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((item) => (
          <button
            type="button"
            key={item.id}
            data-testid={`provider-${item.id}`}
            onClick={() => onChange(item.id)}
            className={`flex h-full min-h-[150px] flex-col rounded-2xl border p-5 text-left transition ${
              value === item.id
                ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]'
            }`}
          >
            <span
              className={`inline-flex rounded-full px-3 py-2 text-xs font-black tracking-wide text-white ${item.color}`}
            >
              {item.mark}
            </span>
            <span className="mt-5 block font-semibold text-[var(--ink)]">{item.name}</span>
            <span className="mt-1 block text-xs text-[var(--ink-soft)]">
              {item.kind === 'BANK' ? 'Indian bank' : 'Education finance NBFC'}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function DetailsStep({
  value,
  onChange,
  evidence,
  setEvidence,
  accepted,
  setAccepted,
}: {
  value: Details;
  onChange(value: Details): void;
  evidence?: File;
  setEvidence(file?: File): void;
  accepted: boolean;
  setAccepted(value: boolean): void;
}) {
  const input = (key: keyof Details, label: string, required = true) => (
    <Field label={`${label}${required ? ' *' : ''}`}>
      <TextInput
        value={value[key]}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
      />
    </Field>
  );

  return (
    <>
      <SectionTitle
        eyebrow="Student and loan details"
        title="Tell us who is making this payment"
        copy="Step 5 of 5. Confirm the student, loan, payer, and evidence details."
      />

      <div className="space-y-8">
        <FormSection title="Your details">
          {input('email', 'Email')}
          {input('firstName', 'First name')}
          {input('middleName', 'Middle name', false)}
          {input('familyName', 'Family name')}
          {input('phone', 'Phone number')}
        </FormSection>

        <FormSection title="Address">
          {input('pinCode', 'PIN code')}
          {input('address1', 'Address line 1')}
          {input('address2', 'Address line 2', false)}
          {input('city', 'City')}
          {input('state', 'State', false)}
        </FormSection>

        <FormSection title="Approved loan">
          {input('branch', 'RACPC / loan centre')}
          {input('loanAccount', 'Loan account number')}
          {input('sanctionReference', 'Sanction reference')}
        </FormSection>

        <FormSection title="Payer details">
          {input('payerName', 'Payer name')}
          <Field label="Payer relationship *">
            <Select
              value={value.relationship}
              onChange={(event) => onChange({ ...value, relationship: event.target.value })}
            >
              <option>Parent</option>
              <option>Self</option>
              <option>Guardian</option>
            </Select>
          </Field>
          {input('pan', 'PAN of payer')}
        </FormSection>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold text-[var(--ink)]">Evidence</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Attach the loan sanction letter.
              </p>
            </div>
            <button
              type="button"
              className="btn-row-action"
              onClick={() =>
                setEvidence(
                  new File(
                    ['%PDF-1.4\nSynthetic TuitionFlow sanction evidence\n%%EOF'],
                    'synthetic-sanction-letter.pdf',
                    { type: 'application/pdf' },
                  ),
                )
              }
            >
              Use sample evidence
            </button>
          </div>

          {evidence ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[rgba(5,150,105,0.04)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--success)]">Attached</div>
                <div className="mt-1 break-all text-sm text-[var(--ink)]">{evidence.name}</div>
              </div>
              <div className="row-actions">
                <label className="btn-row-action cursor-pointer">
                  Replace
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(event) => setEvidence(event.target.files?.[0])}
                  />
                </label>
                <button type="button" className="btn-row-action" onClick={() => setEvidence()}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="block rounded-xl border-2 border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--ink-soft)]">
              Attach PDF, JPG or PNG
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="mt-3 block w-full text-xs"
                onChange={(event) => setEvidence(event.target.files?.[0])}
              />
            </label>
          )}
        </section>
      </div>

      <label className="mt-8 flex items-start gap-3 text-sm text-[var(--ink-soft)]">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          I confirm this is an existing sanctioned education loan and consent to the stated
          compliance checks and document processing.
        </span>
      </label>
    </>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-semibold text-[var(--ink)]">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function PaymentSummary({
  institution,
  semesterLabel,
  totalMinor,
  sourceMinor,
  provider,
}: {
  institution: string;
  semesterLabel: string;
  totalMinor: bigint;
  sourceMinor: bigint;
  provider?: string;
}) {
  return (
    <Card className="h-fit overflow-hidden lg:sticky lg:top-24">
      <div className="bg-[var(--ink)] p-5 text-[var(--bg)]">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--border)]">
          Payment summary
        </div>
        <div className="mt-3 text-lg font-semibold">{institution || 'Select an institution'}</div>
      </div>

      <div className="space-y-4 p-5 text-sm">
        <SummaryRow label="University receives" value={formatCurrency(totalMinor, 'GBP')} />
        <SummaryRow label="Semester" value={semesterLabel} />
        <SummaryRow label="Indicative INR" value={formatCurrency(sourceMinor, 'INR')} />
        <SummaryRow label="Origin" value="India" />
        <SummaryRow label="Funding" value="Full education loan" />
        <SummaryRow label="Provider" value={provider ?? 'Not selected'} />
        <div className="rounded-xl bg-[var(--warning-bg)] p-3 text-xs leading-5 text-[var(--warning)]">
          Final FX, tax and eligibility are supplied by the authorised partner before payout.
        </div>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{value}</span>
    </div>
  );
}

function parseMinor(value: string): bigint {
  const normalized = value.trim();
  if (!normalized) return 0n;
  const [whole = '0', fraction = ''] = normalized.split('.');
  return BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
}

function formatCurrency(minor: bigint, currency: 'GBP' | 'INR'): string {
  const symbol = currency === 'GBP' ? '£' : '₹';
  return `${symbol}${(minor / 100n).toLocaleString('en-IN')}.${(minor % 100n)
    .toString()
    .padStart(2, '0')}`;
}

function requiredDetails(value: Details): boolean {
  return (
    [
      value.email,
      value.firstName,
      value.familyName,
      value.pinCode,
      value.address1,
      value.city,
      value.phone,
      value.branch,
      value.loanAccount,
      value.sanctionReference,
      value.payerName,
      value.relationship,
      value.pan,
    ].every((field) => field.trim() !== '') && /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(value.pan)
  );
}
