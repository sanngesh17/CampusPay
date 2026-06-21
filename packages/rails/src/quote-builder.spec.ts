import { Money } from '@tuitionflow/domain';
import type { RailConfig, TcsConfig } from './config';
import { buildQuote, computeFee, computeTcs } from './quote-builder';
import type { FundingType, QuoteRequest } from './types';

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

const PRINCIPAL = 100_000_000n; // ₹10,00,000 in paise

function req(funding: FundingType): QuoteRequest {
  return {
    amount: Money.of(PRINCIPAL, 'INR'),
    sourceCurrency: 'INR',
    targetCurrency: 'USD',
    mode: funding === 'LOAN' ? 'INTEGRATED' : 'DIRECT',
    funding,
  };
}

describe('quote-builder', () => {
  it('charges 0% TCS for loan-funded education', () => {
    expect(computeTcs(Money.of(PRINCIPAL, 'INR'), 'LOAN', tcsConfig).isZero()).toBe(true);
  });

  it('charges 5% above the ₹7L threshold for self-funded', () => {
    // (₹10L - ₹7L) × 5% = ₹3L × 5% = ₹15,000 = 1,500,000 paise
    expect(computeTcs(Money.of(PRINCIPAL, 'INR'), 'SELF', tcsConfig).minor).toBe(1_500_000n);
  });

  it('computes fee = flat + bps of principal (Rail A)', () => {
    // 50,000 + 100,000,000 × 25bps = 50,000 + 250,000 = 300,000 paise
    expect(computeFee(Money.of(PRINCIPAL, 'INR'), 'A', railConfig).minor).toBe(300_000n);
  });

  it('builds a consistent loan quote: finalPayable = principal + fees (0 TCS)', () => {
    const q = buildQuote(req('LOAN'), 'A', { railConfig, tcsConfig }, new Date(0));
    expect(q.tcs.isZero()).toBe(true);
    expect(q.fees.minor).toBe(300_000n);
    expect(q.finalPayable.minor).toBe(PRINCIPAL + 300_000n);
    expect(q.fxRate).toContain('0.012');
    expect(q.isExpired(new Date(0))).toBe(false);
  });

  it('builds a consistent self-funded quote: includes TCS', () => {
    const q = buildQuote(req('SELF'), 'A', { railConfig, tcsConfig }, new Date(0));
    expect(q.tcs.minor).toBe(1_500_000n);
    expect(q.finalPayable.minor).toBe(PRINCIPAL + 300_000n + 1_500_000n);
  });
});
