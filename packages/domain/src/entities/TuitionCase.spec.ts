import { IllegalTransition, QuoteExpiredError } from '../errors/DomainError';
import { CaseStatus } from '../state-machine/CaseStatus';
import { Money } from '../value-objects/Money';
import { CaseId, LenderId, QuoteId, StudentId, UniversityId } from '../value-objects/ids';
import { Quote } from './Quote';
import { TuitionCase, type CreateCaseProps, type PaymentMode } from './TuitionCase';

function makeCase(mode: PaymentMode = 'INTEGRATED'): TuitionCase {
  const props: CreateCaseProps = {
    id: CaseId.generate(),
    mode,
    student: { id: StudentId.generate(), displayName: 'A. Student' },
    lender: { id: LenderId.generate(), name: 'SBI' },
    beneficiary: { id: UniversityId.generate(), name: 'Test University' },
    amount: Money.of(1_000_000n, 'INR'),
  };
  return TuitionCase.create(props);
}

function makeQuote(expiresAt: Date): Quote {
  const principal = Money.of(1_000_000n, 'INR');
  const fees = Money.of(2_500n, 'INR');
  const tcs = Money.zero('INR');
  return new Quote({
    id: QuoteId.generate(),
    fxRate: '1 GBP = 105 INR',
    principal,
    fees,
    tcs,
    finalPayable: principal.add(fees).add(tcs),
    expiresAt,
  });
}

describe('TuitionCase aggregate', () => {
  it('starts at CASE_CREATED and emits CaseCreated once', () => {
    const c = makeCase();
    expect(c.status).toBe(CaseStatus.CASE_CREATED);
    expect(c.pullEvents().map((e) => e.type)).toEqual(['CaseCreated']);
    expect(c.pullEvents()).toEqual([]); // drained
  });

  it('drives the full happy path, recording events in order', () => {
    const c = makeCase();
    c.pullEvents(); // discard CaseCreated

    c.collectDocs();
    c.validate();
    c.submitToPartner();
    c.recordKycVerified();
    c.lockQuote(makeQuote(new Date(Date.now() + 60_000)), 'B');
    c.markFunded();
    c.enterSettlement();
    c.markPaid('PMT-123');
    c.reconcile();

    expect(c.status).toBe(CaseStatus.RECONCILED);
    expect(c.rail).toBe('B');
    expect(c.quote).toBeDefined();
    expect(c.pullEvents().map((e) => e.type)).toEqual([
      'DocsCollected',
      'CaseValidated',
      'QuoteLocked',
      'CaseFunded',
      'PaymentSettled',
      'CaseReconciled',
    ]);
  });

  it('rejects an illegal transition (markPaid from CASE_CREATED)', () => {
    const c = makeCase();
    expect(() => c.markPaid('x')).toThrow(IllegalTransition);
    expect(c.status).toBe(CaseStatus.CASE_CREATED);
  });

  it('rejects an expired quote without transitioning', () => {
    const c = makeCase();
    c.collectDocs();
    c.validate();
    c.submitToPartner();
    c.recordKycVerified();
    expect(() => c.lockQuote(makeQuote(new Date(Date.now() - 1_000)), 'A')).toThrow(
      QuoteExpiredError,
    );
    expect(c.status).toBe(CaseStatus.KYC_VERIFIED);
    expect(c.quote).toBeUndefined();
  });

  it('supports the failure + refund path', () => {
    const c = makeCase();
    c.collectDocs();
    c.fail('documents invalid');
    expect(c.status).toBe(CaseStatus.FAILED);
    expect(c.failureReason).toBe('documents invalid');
    c.initiateRefund();
    expect(c.status).toBe(CaseStatus.REFUND_INITIATED);
  });
});
