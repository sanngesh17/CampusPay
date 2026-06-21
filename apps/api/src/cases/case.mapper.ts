import {
  CaseId,
  LenderId,
  Money,
  Quote,
  QuoteId,
  StudentId,
  TuitionCase,
  UniversityId,
} from '@tuitionflow/domain';
import type { StoredCase, StoredQuote } from '../persistence/records';

/** Rebuild the domain aggregate from its stored form (no events emitted). */
export function rehydrateCase(rec: StoredCase): TuitionCase {
  return TuitionCase.rehydrate({
    id: CaseId.create(rec.id),
    mode: rec.mode,
    student: { id: StudentId.create(rec.student.id), displayName: rec.student.displayName },
    lender: { id: LenderId.create(rec.lender.id), name: rec.lender.name },
    beneficiary: { id: UniversityId.create(rec.beneficiary.id), name: rec.beneficiary.name },
    amount: Money.of(BigInt(rec.amountMinor), rec.currency),
    status: rec.status,
    rail: rec.rail,
    failureReason: rec.failureReason,
  });
}

/** Rebuild a domain Quote from its stored form (re-validates principal + fees + tcs = finalPayable). */
export function rebuildQuote(sq: StoredQuote): Quote {
  return new Quote({
    id: QuoteId.create(sq.id),
    fxRate: sq.fxRate,
    principal: Money.of(BigInt(sq.principalMinor), sq.currency),
    fees: Money.of(BigInt(sq.feesMinor), sq.currency),
    tcs: Money.of(BigInt(sq.tcsMinor), sq.currency),
    finalPayable: Money.of(BigInt(sq.finalPayableMinor), sq.currency),
    expiresAt: new Date(sq.expiresAt),
  });
}
