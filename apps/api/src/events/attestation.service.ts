import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CaseStatus } from '@tuitionflow/domain';
import type { XrplGateway } from '@tuitionflow/xrpl';
import type { AttestationRepository } from '../persistence/ports';
import type { AttestationRecord } from '../persistence/records';
import { ATTESTATION_REPOSITORY, XRPL_GATEWAY } from '../tokens';

const SHA256_HEX = /^[a-f0-9]{64}$/;

/**
 * Anchors a finalised milestone on-chain as a hash (never PII) and records it. The digest is a
 * sha256 of the case id + milestone + payload, asserted to be a 64-hex hash before it leaves.
 */
@Injectable()
export class AttestationService {
  constructor(
    @Inject(XRPL_GATEWAY) private readonly gateway: XrplGateway,
    @Inject(ATTESTATION_REPOSITORY) private readonly repo: AttestationRepository,
  ) {}

  async recordMilestone(
    caseId: string,
    milestone: CaseStatus,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const sha256 = createHash('sha256')
      .update(`${caseId}|${milestone}|${JSON.stringify(payload)}`)
      .digest('hex');
    if (!SHA256_HEX.test(sha256)) {
      throw new Error('Attestation digest must be a sha256 hash');
    }
    const tx = await this.gateway.writeAttestation({ caseId, milestone, sha256 });
    await this.repo.add({
      id: randomUUID(),
      caseId,
      milestone,
      sha256,
      txHash: tx.hash,
      createdAt: new Date().toISOString(),
    });
  }

  list(caseId: string): Promise<AttestationRecord[]> {
    return this.repo.listByCase(caseId);
  }
}
