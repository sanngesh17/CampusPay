import { RemittanceCase, RemittanceStatus } from './RemittanceCase';

describe('RemittanceCase', () => {
  it('requires every partial-loan funding leg before funds are received', () => {
    const payment = new RemittanceCase({
      id: 'case-1',
      studentId: 'student-1',
      studentAge: 21,
      fundingType: 'PARTIAL_LOAN',
      sourceAmountMinor: 1_000n,
      lenderAmountMinor: 700n,
      currency: 'INR',
    });
    payment.transition(RemittanceStatus.EVIDENCE_SUBMITTED);
    payment.transition(RemittanceStatus.COMPLIANCE_PENDING);
    payment.transition(RemittanceStatus.INSTRUCTION_ISSUED);
    payment.transition(RemittanceStatus.FUNDING_PENDING);
    payment.recordFunding('LENDER', 700n, 'UTR-LENDER');
    expect(() => payment.transition(RemittanceStatus.FUNDS_RECEIVED)).toThrow('All funding legs');
    payment.recordFunding('STUDENT', 300n, 'UTR-STUDENT');
    payment.transition(RemittanceStatus.FUNDS_RECEIVED);
    expect(payment.status).toBe(RemittanceStatus.FUNDS_RECEIVED);
  });

  it('rejects minors and inconsistent funding splits', () => {
    expect(
      () =>
        new RemittanceCase({
          id: 'case-2',
          studentId: 'student-2',
          studentAge: 17,
          fundingType: 'SELF_FUNDED',
          sourceAmountMinor: 1_000n,
          currency: 'INR',
        }),
    ).toThrow('at least 18');
    expect(
      () =>
        new RemittanceCase({
          id: 'case-3',
          studentId: 'student-3',
          studentAge: 21,
          fundingType: 'FULL_LOAN',
          sourceAmountMinor: 1_000n,
          lenderAmountMinor: 500n,
          currency: 'INR',
        }),
    ).toThrow('entire amount');
  });
});
