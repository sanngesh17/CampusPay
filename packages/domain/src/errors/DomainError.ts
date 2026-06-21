/**
 * Typed domain exceptions. The framework boundary (apps/api global filter) maps these to HTTP codes.
 * Never throw bare `Error` from the domain; never swallow these.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
    // Restore prototype chain (needed when targeting ES5/ES2022 with extended built-ins).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a case is asked to move between two states with no legal edge. */
export class IllegalTransition extends DomainError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Illegal case transition: ${from} -> ${to}`, 'ILLEGAL_TRANSITION');
  }
}

/** Thrown by the rail router when no adapter supports a quote request. */
export class NoEligibleRailError extends DomainError {
  constructor(detail?: string) {
    super(`No eligible rail for request${detail ? `: ${detail}` : ''}`, 'NO_ELIGIBLE_RAIL');
  }
}

/** Thrown when an expired quote is used to lock a case. */
export class QuoteExpiredError extends DomainError {
  constructor() {
    super('Quote has expired', 'QUOTE_EXPIRED');
  }
}
