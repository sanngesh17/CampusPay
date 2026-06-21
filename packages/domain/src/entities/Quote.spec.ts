import { DomainError } from '../errors/DomainError';
import { Money } from '../value-objects/Money';
import { QuoteId } from '../value-objects/ids';
import { Quote } from './Quote';

const base = {
  id: QuoteId.generate(),
  fxRate: '1 GBP = 105 INR',
  principal: Money.of(1_000_000n, 'INR'),
  fees: Money.of(2_500n, 'INR'),
  tcs: Money.zero('INR'),
};

describe('Quote', () => {
  it('rejects an inconsistent finalPayable', () => {
    expect(
      () => new Quote({ ...base, finalPayable: Money.of(1n, 'INR'), expiresAt: new Date() }),
    ).toThrow(DomainError);
  });

  it('accepts principal + fees + tcs', () => {
    const q = new Quote({
      ...base,
      finalPayable: Money.of(1_002_500n, 'INR'),
      expiresAt: new Date(Date.now() + 1_000),
    });
    expect(q.finalPayable.minor).toBe(1_002_500n);
  });

  it('isExpired reflects the supplied clock', () => {
    const q = new Quote({
      ...base,
      finalPayable: Money.of(1_002_500n, 'INR'),
      expiresAt: new Date(1_000),
    });
    expect(q.isExpired(new Date(2_000))).toBe(true);
    expect(q.isExpired(new Date(500))).toBe(false);
  });
});
