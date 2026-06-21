import { createHash } from 'node:crypto';
import type {
  AttestationInput,
  AttestationProof,
  DomainId,
  DomainParams,
  IssueCredentialParams,
  SubmittableTx,
  TxResult,
  VerifyCredentialParams,
  XrplGateway,
} from '@tuitionflow/xrpl';

/**
 * Default gateway for dev/test: records what WOULD be written on-chain and returns deterministic fake
 * tx hashes — no network. The real on-chain behaviour is covered by @tuitionflow/xrpl's Testnet
 * integration tests; here we only need to assert that the app fires attestations at the right
 * milestones. Type-only import of XrplGateway means the xrpl SDK is never loaded by this file.
 */
export class RecordingXrplGateway implements XrplGateway {
  readonly attestations: AttestationInput[] = [];
  readonly credentials: IssueCredentialParams[] = [];

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async issueCredential(params: IssueCredentialParams): Promise<TxResult> {
    this.credentials.push(params);
    return this.fakeTx('cred', params.subject + params.credentialType);
  }

  async verifyCredential(_params: VerifyCredentialParams): Promise<boolean> {
    return true;
  }

  async setupPermissionedDomain(_params: DomainParams): Promise<DomainId> {
    return 'mock-permissioned-domain';
  }

  async writeAttestation(input: AttestationInput): Promise<TxResult> {
    this.attestations.push(input);
    return this.fakeTx('att', input.caseId + input.milestone + input.sha256);
  }

  async verifyAttestation(proof: AttestationProof): Promise<boolean> {
    return this.attestations.some((a) => a.sha256 === proof.sha256);
  }

  async submitBatch(txns: SubmittableTx[]): Promise<TxResult> {
    for (const t of txns) this.attestations.push(t);
    return this.fakeTx('batch', txns.map((t) => t.sha256).join('|'));
  }

  private fakeTx(kind: string, seed: string): TxResult {
    const hash = createHash('sha256').update(`${kind}:${seed}`).digest('hex').toUpperCase();
    return { hash, validated: true, engineResult: 'tesSUCCESS' };
  }
}
