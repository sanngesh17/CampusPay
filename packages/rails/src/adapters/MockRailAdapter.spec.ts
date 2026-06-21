import { Money } from '@tuitionflow/domain';
import type { RailConfig, TcsConfig } from '../config';
import { RailError } from '../errors';
import type { InitiationRequest, QuoteRequest } from '../types';
import { MockRailAdapter } from './MockRailAdapter';

const railConfig: RailConfig = {
  capInrMinor: 2_500_000_000,
  fees: {
    A: { flatMinor: 50_000, bps: 25 },
    B: { flatMinor: 150_000, bps: 35 },
    C: { flatMinor: 0, bps: 20 },
  },
  fx: { INR_GBP: 0.0095, INR_USD: 0.012 },
  corridors: { A: ['GBP', 'USD'], B: ['GBP', 'USD'], C: ['USD'] },
  featureFlags: { rippleRail: false },
};

const tcsConfig: TcsConfig = {
  thresholdMinor: 70_000_000,
  purposes: {
    EDUCATION_LOAN: { ratePct: 0, appliesAboveThresholdOnly: true },
    EDUCATION_SELF: { ratePct: 5, appliesAboveThresholdOnly: true },
  },
};

const quoteReq: QuoteRequest = {
  amount: Money.of(100_000_000n, 'INR'),
  sourceCurrency: 'INR',
  targetCurrency: 'USD',
  mode: 'INTEGRATED',
  funding: 'LOAN',
};

function adapter(): MockRailAdapter {
  return new MockRailAdapter({ railConfig, tcsConfig });
}

describe('MockRailAdapter', () => {
  it('supports INR ≤ cap; rejects above cap and non-INR', () => {
    const a = adapter();
    expect(a.supports(quoteReq)).toBe(true);
    expect(a.supports({ ...quoteReq, amount: Money.of(2_500_000_001n, 'INR') })).toBe(false);
    expect(a.supports({ ...quoteReq, sourceCurrency: 'GBP', amount: Money.of(1n, 'GBP') })).toBe(
      false,
    );
  });

  it('quotes loan-funded with 0% TCS', async () => {
    const q = await adapter().getQuote(quoteReq);
    expect(q.tcs.isZero()).toBe(true);
  });

  it('is idempotent on initiate (same key => same payment)', async () => {
    const a = adapter();
    const quote = await a.getQuote(quoteReq);
    const init: InitiationRequest = {
      quote,
      caseId: 'case_1',
      beneficiaryRef: 'BEN1',
      reference: 'UNI-123456',
      idempotencyKey: 'idem-1',
    };
    const r1 = await a.initiatePayment(init);
    const r2 = await a.initiatePayment(init);
    expect(r1.paymentId).toBe(r2.paymentId);
  });

  it('advances a case end-to-end to PAID and emits a hash-bearing receipt', async () => {
    const a = adapter();
    const quote = await a.getQuote(quoteReq);
    const init: InitiationRequest = {
      quote,
      caseId: 'case_1',
      beneficiaryRef: 'BEN1',
      reference: 'UNI-123456',
      idempotencyKey: 'idem-2',
    };
    const ref = await a.initiatePayment(init);

    await expect(a.getReceipt(ref)).rejects.toThrow(RailError); // not ready before PAID

    const seen: string[] = [];
    let status = (await a.getStatus(ref)).status;
    seen.push(status);
    for (let i = 0; i < 5 && status !== 'PAID'; i += 1) {
      status = (await a.getStatus(ref)).status;
      seen.push(status);
    }
    expect(status).toBe('PAID');
    expect(seen).toEqual(expect.arrayContaining(['KYC_VERIFIED', 'IN_SETTLEMENT', 'PAID']));

    const receipt = await a.getReceipt(ref);
    expect(receipt.caseId).toBe('case_1');
    expect(receipt.amountPaid.minor).toBe(quote.finalPayable.minor);
    expect(receipt.proofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.rail).toBe('A');
  });
});
