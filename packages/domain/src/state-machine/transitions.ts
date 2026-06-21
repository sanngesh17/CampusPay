import { CaseStatus } from './CaseStatus';

/**
 * The full guarded transition table. Each key lists the only states reachable from it.
 * Terminal states (RECONCILED, REFUND_INITIATED) have no outward edges.
 */
export const TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  [CaseStatus.DRAFT]: [CaseStatus.CASE_CREATED, CaseStatus.FAILED],
  [CaseStatus.CASE_CREATED]: [CaseStatus.DOCS_COLLECTED, CaseStatus.FAILED],
  [CaseStatus.DOCS_COLLECTED]: [CaseStatus.VALIDATED, CaseStatus.FAILED],
  [CaseStatus.VALIDATED]: [CaseStatus.SUBMITTED_TO_PARTNER, CaseStatus.FAILED],
  [CaseStatus.SUBMITTED_TO_PARTNER]: [
    CaseStatus.KYC_VERIFIED,
    CaseStatus.KYC_REJECTED,
    CaseStatus.FAILED,
  ],
  [CaseStatus.KYC_VERIFIED]: [CaseStatus.QUOTE_LOCKED, CaseStatus.FAILED],
  [CaseStatus.KYC_REJECTED]: [CaseStatus.FAILED, CaseStatus.REFUND_INITIATED],
  [CaseStatus.QUOTE_LOCKED]: [CaseStatus.FUNDED, CaseStatus.FAILED],
  [CaseStatus.FUNDED]: [CaseStatus.IN_SETTLEMENT, CaseStatus.FAILED],
  [CaseStatus.IN_SETTLEMENT]: [CaseStatus.PAID, CaseStatus.FAILED],
  [CaseStatus.PAID]: [CaseStatus.RECONCILED, CaseStatus.REFUND_INITIATED],
  [CaseStatus.RECONCILED]: [],
  [CaseStatus.FAILED]: [CaseStatus.REFUND_INITIATED],
  [CaseStatus.REFUND_INITIATED]: [],
};

export function isTerminal(status: CaseStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
