/**
 * Case lifecycle states. Modelled as a string enum (not the numeric form sketched in the build
 * guide §6) so values are stable across DB migrations and human-readable in audit logs.
 */
export enum CaseStatus {
  DRAFT = 'DRAFT',
  CASE_CREATED = 'CASE_CREATED',
  DOCS_COLLECTED = 'DOCS_COLLECTED',
  VALIDATED = 'VALIDATED',
  SUBMITTED_TO_PARTNER = 'SUBMITTED_TO_PARTNER',
  KYC_VERIFIED = 'KYC_VERIFIED',
  KYC_REJECTED = 'KYC_REJECTED',
  QUOTE_LOCKED = 'QUOTE_LOCKED',
  FUNDED = 'FUNDED',
  IN_SETTLEMENT = 'IN_SETTLEMENT',
  PAID = 'PAID',
  RECONCILED = 'RECONCILED',
  FAILED = 'FAILED',
  REFUND_INITIATED = 'REFUND_INITIATED',
}

/**
 * Milestones that MUST be anchored on-chain (hash only) when the case enters them.
 * Consumed by apps/api's event dispatcher to enqueue an attestation.
 */
export const ATTESTED_STATUSES: ReadonlySet<CaseStatus> = new Set([
  CaseStatus.VALIDATED,
  CaseStatus.QUOTE_LOCKED,
  CaseStatus.PAID,
  CaseStatus.RECONCILED,
]);
