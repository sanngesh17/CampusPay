import { DomainError } from '../errors/DomainError';
import { CaseStatus } from '../state-machine/CaseStatus';
import { AttestationId, CaseId } from '../value-objects/ids';
import { Attestation } from './Attestation';

const digest = 'a'.repeat(64);

describe('Attestation (digest guard + immutability)', () => {
  it('rejects a non-sha256 digest — PII can never be held', () => {
    expect(
      () =>
        new Attestation({
          id: AttestationId.generate(),
          caseId: CaseId.generate(),
          milestone: CaseStatus.PAID,
          sha256: 'student@example.com',
          createdAt: new Date(),
        }),
    ).toThrow(DomainError);
  });

  it('anchors a tx hash immutably (original unchanged)', () => {
    const a = new Attestation({
      id: AttestationId.generate(),
      caseId: CaseId.generate(),
      milestone: CaseStatus.PAID,
      sha256: digest,
      createdAt: new Date(),
    });
    expect(a.isAnchored).toBe(false);

    const anchored = a.withTxHash('TX123');
    expect(anchored.isAnchored).toBe(true);
    expect(anchored.txHash).toBe('TX123');
    expect(a.isAnchored).toBe(false);
  });
});
