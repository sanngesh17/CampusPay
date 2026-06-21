import { QuoteExpiredError } from '../errors/DomainError';
import type { DomainEvent } from '../events/DomainEvent';
import { CaseStatus } from '../state-machine/CaseStatus';
import { CaseStateMachine } from '../state-machine/CaseStateMachine';
import type { Money } from '../value-objects/Money';
import type { CaseId } from '../value-objects/ids';
import type { LenderRef } from './Lender';
import type { Quote } from './Quote';
import type { StudentRef } from './Student';
import type { UniversityRef } from './University';

export type PaymentMode = 'INTEGRATED' | 'DIRECT';
export type RailType = 'A' | 'B' | 'C';

export interface CreateCaseProps {
  readonly id: CaseId;
  readonly mode: PaymentMode;
  readonly student: StudentRef;
  readonly lender: LenderRef;
  readonly beneficiary: UniversityRef;
  readonly amount: Money;
}

export interface RehydrateCaseProps extends CreateCaseProps {
  readonly status: CaseStatus;
  readonly quote?: Quote;
  readonly rail?: RailType;
  readonly failureReason?: string;
}

/**
 * Aggregate root. All mutation goes through behaviour methods, each of which (1) asserts the
 * transition is legal via the state machine and (2) records a domain event. Side effects
 * (on-chain attestation, notifications) are handled outside the domain by consuming pulled events.
 */
export class TuitionCase {
  readonly id: CaseId;
  readonly mode: PaymentMode;
  readonly student: StudentRef;
  readonly lender: LenderRef;
  readonly beneficiary: UniversityRef;

  private _status: CaseStatus;
  private _amount: Money;
  private _quote?: Quote;
  private _rail?: RailType;
  private _failureReason?: string;

  private readonly sm = new CaseStateMachine();
  private events: DomainEvent[] = [];

  private constructor(props: CreateCaseProps, status: CaseStatus) {
    this.id = props.id;
    this.mode = props.mode;
    this.student = props.student;
    this.lender = props.lender;
    this.beneficiary = props.beneficiary;
    this._amount = props.amount;
    this._status = status;
  }

  /** Factory for a brand-new case. Starts at CASE_CREATED and emits CaseCreated. */
  static create(props: CreateCaseProps): TuitionCase {
    const c = new TuitionCase(props, CaseStatus.CASE_CREATED);
    c.record({ type: 'CaseCreated', caseId: props.id, occurredAt: new Date() });
    return c;
  }

  /** Rebuild from persistence without emitting events. */
  static rehydrate(props: RehydrateCaseProps): TuitionCase {
    const c = new TuitionCase(props, props.status);
    if (props.quote !== undefined) c._quote = props.quote;
    if (props.rail !== undefined) c._rail = props.rail;
    if (props.failureReason !== undefined) c._failureReason = props.failureReason;
    return c;
  }

  get status(): CaseStatus {
    return this._status;
  }
  get amount(): Money {
    return this._amount;
  }
  get quote(): Quote | undefined {
    return this._quote;
  }
  get rail(): RailType | undefined {
    return this._rail;
  }
  get failureReason(): string | undefined {
    return this._failureReason;
  }

  collectDocs(): void {
    this.transition(CaseStatus.DOCS_COLLECTED);
    this.record({ type: 'DocsCollected', caseId: this.id, occurredAt: new Date() });
  }

  validate(): void {
    this.transition(CaseStatus.VALIDATED);
    this.record({ type: 'CaseValidated', caseId: this.id, occurredAt: new Date() });
  }

  submitToPartner(): void {
    this.transition(CaseStatus.SUBMITTED_TO_PARTNER);
  }

  recordKycVerified(): void {
    this.transition(CaseStatus.KYC_VERIFIED);
  }

  recordKycRejected(reason: string): void {
    this.transition(CaseStatus.KYC_REJECTED);
    this._failureReason = reason;
  }

  lockQuote(quote: Quote, rail: RailType, now: Date = new Date()): void {
    if (quote.isExpired(now)) throw new QuoteExpiredError();
    this.transition(CaseStatus.QUOTE_LOCKED);
    this._quote = quote;
    this._rail = rail;
    this.record({
      type: 'QuoteLocked',
      caseId: this.id,
      occurredAt: new Date(),
      quoteId: quote.id,
      rail,
    });
  }

  markFunded(): void {
    this.transition(CaseStatus.FUNDED);
    this.record({ type: 'CaseFunded', caseId: this.id, occurredAt: new Date() });
  }

  enterSettlement(): void {
    this.transition(CaseStatus.IN_SETTLEMENT);
  }

  markPaid(paymentRef: string): void {
    this.transition(CaseStatus.PAID);
    this.record({ type: 'PaymentSettled', caseId: this.id, occurredAt: new Date(), paymentRef });
  }

  reconcile(): void {
    this.transition(CaseStatus.RECONCILED);
    this.record({ type: 'CaseReconciled', caseId: this.id, occurredAt: new Date() });
  }

  fail(reason: string): void {
    this.transition(CaseStatus.FAILED);
    this._failureReason = reason;
    this.record({ type: 'CaseFailed', caseId: this.id, occurredAt: new Date(), reason });
  }

  initiateRefund(): void {
    this.transition(CaseStatus.REFUND_INITIATED);
  }

  /** Drain accumulated events for the caller to dispatch (then clears them). */
  pullEvents(): DomainEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private transition(to: CaseStatus): void {
    this.sm.assertCanTransition(this._status, to);
    this._status = to;
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}
