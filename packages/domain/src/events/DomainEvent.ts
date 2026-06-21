import type { CaseId } from '../value-objects/ids';

interface BaseEvent {
  readonly occurredAt: Date;
  readonly caseId: CaseId;
}

export interface CaseCreated extends BaseEvent {
  readonly type: 'CaseCreated';
}
export interface DocsCollected extends BaseEvent {
  readonly type: 'DocsCollected';
}
export interface CaseValidated extends BaseEvent {
  readonly type: 'CaseValidated';
}
export interface QuoteLocked extends BaseEvent {
  readonly type: 'QuoteLocked';
  readonly quoteId: string;
  readonly rail: string;
}
export interface CaseFunded extends BaseEvent {
  readonly type: 'CaseFunded';
}
export interface PaymentSettled extends BaseEvent {
  readonly type: 'PaymentSettled';
  readonly paymentRef: string;
}
export interface CaseReconciled extends BaseEvent {
  readonly type: 'CaseReconciled';
}
export interface CaseFailed extends BaseEvent {
  readonly type: 'CaseFailed';
  readonly reason: string;
}

/** All domain events, as a discriminated union keyed on `type`. */
export type DomainEvent =
  | CaseCreated
  | DocsCollected
  | CaseValidated
  | QuoteLocked
  | CaseFunded
  | PaymentSettled
  | CaseReconciled
  | CaseFailed;

export type DomainEventType = DomainEvent['type'];

/** Event types whose milestone must be anchored on-chain (hash only). */
export const ATTESTABLE_EVENT_TYPES: ReadonlySet<DomainEventType> = new Set<DomainEventType>([
  'CaseValidated',
  'QuoteLocked',
  'PaymentSettled',
  'CaseReconciled',
]);
