import type {
  AttestationInput,
  AttestationProof,
  DomainId,
  DomainParams,
  IssueCredentialParams,
  SubmittableTx,
  TxResult,
  VerifyCredentialParams,
} from './types';

/**
 * Clean async gateway over the XRP Ledger. Implementations wrap xrpl.js internally; no xrpl.js
 * types appear in this contract. See build guide §7.1.
 */
export interface XrplGateway {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** XLS-70 Credentials — vet lenders / universities / partners. */
  issueCredential(p: IssueCredentialParams): Promise<TxResult>;
  verifyCredential(p: VerifyCredentialParams): Promise<boolean>;

  /** XLS-80 Permissioned Domains — a gated set of vetted counterparties. */
  setupPermissionedDomain(p: DomainParams): Promise<DomainId>;

  /** Attestations — write/verify a hash of a finalised milestone (NO PII). */
  writeAttestation(a: AttestationInput): Promise<TxResult>;
  verifyAttestation(a: AttestationProof): Promise<boolean>;

  /** XLS-56 Batch — bundle e.g. attestation + receipt atomically. */
  submitBatch(txns: SubmittableTx[]): Promise<TxResult>;
}
