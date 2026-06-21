import { DomainError } from '../errors/DomainError';
import type { Money } from '../value-objects/Money';
import type { QuoteId } from '../value-objects/ids';

export interface QuoteProps {
  readonly id: QuoteId;
  /** Human-readable FX line, e.g. "1 GBP = 105.2632 INR". Precise math lives in packages/rails. */
  readonly fxRate: string;
  readonly principal: Money;
  readonly fees: Money;
  readonly tcs: Money;
  readonly finalPayable: Money;
  readonly expiresAt: Date;
}

/**
 * A locked price: principal + fees + TCS = finalPayable, with an expiry.
 * The constructor enforces the arithmetic invariant so an inconsistent quote can never exist.
 */
export class Quote {
  readonly id: QuoteId;
  readonly fxRate: string;
  readonly principal: Money;
  readonly fees: Money;
  readonly tcs: Money;
  readonly finalPayable: Money;
  readonly expiresAt: Date;

  constructor(props: QuoteProps) {
    const expected = props.principal.add(props.fees).add(props.tcs);
    if (!expected.equals(props.finalPayable)) {
      throw new DomainError(
        'Quote finalPayable must equal principal + fees + tcs (same currency)',
        'QUOTE_INCONSISTENT',
      );
    }
    this.id = props.id;
    this.fxRate = props.fxRate;
    this.principal = props.principal;
    this.fees = props.fees;
    this.tcs = props.tcs;
    this.finalPayable = props.finalPayable;
    this.expiresAt = props.expiresAt;
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }
}
