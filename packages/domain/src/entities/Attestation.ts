import { DomainError } from '../errors/DomainError';
import type { CaseStatus } from '../state-machine/CaseStatus';
import type { AttestationId, CaseId } from '../value-objects/ids';

const HASH_RE = /^[a-f0-9]{64}$/i;

export interface AttestationProps {
  readonly id: AttestationId;
  readonly caseId: CaseId;
  readonly milestone: CaseStatus;
  /** sha256 hex digest of the finalised milestone payload — NEVER the payload itself. */
  readonly sha256: string;
  readonly createdAt: Date;
  /** XRPL transaction hash, once anchored on-chain. */
  readonly txHash?: string;
}

/**
 * Domain view of an on-chain attestation. The digest invariant is enforced here as a second line
 * of defence — even before the XRPL package's `assertIsHash` guard, an Attestation cannot hold
 * anything but a sha256 hex.
 */
export class Attestation {
  readonly id: AttestationId;
  readonly caseId: CaseId;
  readonly milestone: CaseStatus;
  readonly sha256: string;
  readonly createdAt: Date;
  readonly txHash?: string;

  constructor(props: AttestationProps) {
    if (!HASH_RE.test(props.sha256)) {
      throw new DomainError(
        'Attestation digest must be a 64-char sha256 hex string',
        'ATTESTATION_BAD_DIGEST',
      );
    }
    this.id = props.id;
    this.caseId = props.caseId;
    this.milestone = props.milestone;
    this.sha256 = props.sha256.toLowerCase();
    this.createdAt = props.createdAt;
    if (props.txHash !== undefined) this.txHash = props.txHash;
  }

  get isAnchored(): boolean {
    return this.txHash !== undefined;
  }

  withTxHash(txHash: string): Attestation {
    return new Attestation({
      id: this.id,
      caseId: this.caseId,
      milestone: this.milestone,
      sha256: this.sha256,
      createdAt: this.createdAt,
      txHash,
    });
  }
}
