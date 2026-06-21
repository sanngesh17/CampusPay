import { DomainError } from '../errors/DomainError';
import type { Currency } from './Currency';

/**
 * Money — never use raw numbers for currency. Stores minor units (paise/cents) as `bigint`.
 * Immutable; all arithmetic is integer-only (no floating point). Same-currency operations only.
 */
export class Money {
  private constructor(
    public readonly minor: bigint,
    public readonly currency: Currency,
  ) {}

  static of(minor: bigint, currency: Currency): Money {
    if (minor < 0n) throw new DomainError('Money cannot be negative', 'MONEY_NEGATIVE');
    return new Money(minor, currency);
  }

  static zero(currency: Currency): Money {
    return new Money(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.minor - other.minor;
    if (result < 0n) throw new DomainError('Money cannot be negative', 'MONEY_NEGATIVE');
    return new Money(result, this.currency);
  }

  /** Multiply by basis points (1 bps = 0.01%). Integer math, rounds toward zero. */
  multiplyByBps(bps: number): Money {
    if (!Number.isInteger(bps) || bps < 0) {
      throw new DomainError('bps must be a non-negative integer', 'MONEY_BAD_BPS');
    }
    return new Money((this.minor * BigInt(bps)) / 10_000n, this.currency);
  }

  /** Apply a percentage given as integer numerator/denominator (e.g. 5% => 5/100). Rounds toward zero. */
  applyRatio(numerator: bigint, denominator: bigint): Money {
    if (denominator <= 0n) throw new DomainError('denominator must be positive', 'MONEY_BAD_RATIO');
    if (numerator < 0n) throw new DomainError('numerator must be non-negative', 'MONEY_BAD_RATIO');
    return new Money((this.minor * numerator) / denominator, this.currency);
  }

  isZero(): boolean {
    return this.minor === 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minor < other.minor) return -1;
    if (this.minor > other.minor) return 1;
    return 0;
  }

  gt(other: Money): boolean {
    return this.compare(other) > 0;
  }

  gte(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  lt(other: Money): boolean {
    return this.compare(other) < 0;
  }

  lte(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  toString(): string {
    return `${this.minor.toString()} ${this.currency} (minor)`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(
        `Currency mismatch: ${this.currency} vs ${other.currency}`,
        'MONEY_CURRENCY_MISMATCH',
      );
    }
  }
}
