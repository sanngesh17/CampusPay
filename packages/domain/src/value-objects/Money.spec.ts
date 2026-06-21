import { DomainError } from '../errors/DomainError';
import { Money } from './Money';

describe('Money', () => {
  it('rejects negative amounts', () => {
    expect(() => Money.of(-1n, 'INR')).toThrow(DomainError);
  });

  it('stores minor units and currency', () => {
    const m = Money.of(2_500_000_000n, 'INR');
    expect(m.minor).toBe(2_500_000_000n);
    expect(m.currency).toBe('INR');
  });

  it('adds same-currency amounts', () => {
    expect(Money.of(100n, 'INR').add(Money.of(50n, 'INR')).minor).toBe(150n);
  });

  it('subtracts but never goes negative', () => {
    expect(Money.of(100n, 'INR').subtract(Money.of(40n, 'INR')).minor).toBe(60n);
    expect(() => Money.of(40n, 'INR').subtract(Money.of(100n, 'INR'))).toThrow(DomainError);
  });

  it('throws on currency mismatch', () => {
    expect(() => Money.of(100n, 'INR').add(Money.of(1n, 'USD'))).toThrow(/Currency mismatch/);
    expect(() => Money.of(100n, 'INR').compare(Money.of(1n, 'GBP'))).toThrow(/Currency mismatch/);
  });

  it('multiplyByBps uses integer math, rounding toward zero', () => {
    // 25 bps (0.25%) of 10,00,000 paise = 2,500 paise
    expect(Money.of(1_000_000n, 'INR').multiplyByBps(25).minor).toBe(2_500n);
    // 1 bps of 9,999 paise = 0.9999 -> 0
    expect(Money.of(9_999n, 'INR').multiplyByBps(1).minor).toBe(0n);
    expect(() => Money.of(1n, 'INR').multiplyByBps(-1)).toThrow(DomainError);
    expect(() => Money.of(1n, 'INR').multiplyByBps(1.5)).toThrow(DomainError);
  });

  it('applyRatio computes percentages with integer math', () => {
    expect(Money.of(100_000n, 'INR').applyRatio(5n, 100n).minor).toBe(5_000n);
    expect(() => Money.of(1n, 'INR').applyRatio(1n, 0n)).toThrow(DomainError);
  });

  it('compares and orders amounts', () => {
    const a = Money.of(10n, 'INR');
    const b = Money.of(20n, 'INR');
    expect(a.lt(b)).toBe(true);
    expect(b.gt(a)).toBe(true);
    expect(a.lte(Money.of(10n, 'INR'))).toBe(true);
    expect(a.gte(Money.of(10n, 'INR'))).toBe(true);
    expect(a.equals(Money.of(10n, 'INR'))).toBe(true);
    expect(a.equals(Money.of(10n, 'USD'))).toBe(false);
    expect(a.compare(b)).toBe(-1);
    expect(Money.zero('INR').isZero()).toBe(true);
  });
});
