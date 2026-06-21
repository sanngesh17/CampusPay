import { Money, NoEligibleRailError } from '@tuitionflow/domain';
import type { Currency } from '@tuitionflow/domain';
import type { RailConfig, TcsConfig } from './config';
import { createRailRouter } from './factory';
import type { QuoteRequest } from './types';

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
  purposes: { EDUCATION_LOAN: { ratePct: 0, appliesAboveThresholdOnly: true } },
};

function req(amountMinor: bigint, source: Currency = 'INR'): QuoteRequest {
  return {
    amount: Money.of(amountMinor, source),
    sourceCurrency: source,
    targetCurrency: 'USD',
    mode: 'INTEGRATED',
    funding: 'LOAN',
  };
}

describe('RailRouter selection by amount/eligibility', () => {
  const router = createRailRouter(railConfig, tcsConfig);

  it('selects Rail A (mock) for amounts at or below the ₹25L cap', () => {
    expect(router.select(req(2_500_000_000n)).id).toBe('A');
    expect(router.select(req(100_000_000n)).id).toBe('A');
  });

  it('selects Rail B (AD-bank) for amounts above the cap', () => {
    expect(router.select(req(2_500_000_001n)).id).toBe('B');
  });

  it('throws NoEligibleRailError when nothing supports the request', () => {
    expect(() => router.select(req(100n, 'GBP'))).toThrow(NoEligibleRailError);
  });
});
