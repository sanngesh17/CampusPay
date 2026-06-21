import {
  Client,
  Wallet,
  convertStringToHex,
  isValidClassicAddress,
  type SubmittableTransaction,
} from 'xrpl';
import {
  buildAttestationPayload,
  decodeAttestationMemo,
  encodeAttestationMemo,
} from './attestation-memo';
import { BatchUnsupportedError, NotConnectedError, XrplError } from './errors';
import type { XrplGateway } from './XrplGateway';
import type {
  AcceptCredentialParams,
  AttestationInput,
  AttestationProof,
  DomainId,
  DomainParams,
  IssueCredentialParams,
  SubmittableTx,
  TxResult,
  VerifyCredentialParams,
  XrplClientConfig,
} from './types';

const TF_ALL_OR_NOTHING = 0x00010000; // Batch: all-or-nothing semantics
const TF_INNER_BATCH_TXN = 0x40000000; // marks a transaction as an inner batch member
const LSF_ACCEPTED = 0x00010000; // Credential ledger object: accepted by the subject
const CREDENTIAL_TYPE_MAX_BYTES = 64;

type SubmitResponse = Awaited<ReturnType<Client['submitAndWait']>>;

/** Build an xrpl.js submittable from a plain object — keeps the cast in exactly one place. */
function asTx(obj: Record<string, unknown>): SubmittableTransaction {
  return obj as unknown as SubmittableTransaction;
}

/**
 * Concrete XrplGateway backed by xrpl.js. All writes go through submitAndWait. The signing wallet
 * comes from an env/KMS seed in production; in tests, connect() funds an ephemeral wallet from the
 * faucet. No xrpl.js types escape this file.
 */
export class XrplClient implements XrplGateway {
  private readonly client: Client;
  private readonly seed?: string;
  private wallet?: Wallet;

  constructor(config: XrplClientConfig) {
    this.client = new Client(config.wss);
    if (config.seed !== undefined) this.seed = config.seed;
  }

  async connect(): Promise<void> {
    if (!this.client.isConnected()) await this.client.connect();
    if (this.wallet) return;
    if (this.seed !== undefined) {
      this.wallet = Wallet.fromSeed(this.seed);
    } else {
      const funded = await this.client.fundWallet();
      this.wallet = funded.wallet;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isConnected()) await this.client.disconnect();
  }

  /** Classic address of the signing wallet (after connect). */
  get address(): string {
    return this.ensureWallet().classicAddress;
  }

  // ----- XLS-70 Credentials -----

  async issueCredential(p: IssueCredentialParams): Promise<TxResult> {
    const wallet = this.ensureWallet();
    this.assertAddress(p.subject);
    const obj: Record<string, unknown> = {
      TransactionType: 'CredentialCreate',
      Account: wallet.classicAddress,
      Subject: p.subject,
      CredentialType: this.credentialTypeHex(p.credentialType),
    };
    if (p.expirationRippleTime !== undefined) obj.Expiration = p.expirationRippleTime;
    if (p.uri !== undefined) obj.URI = convertStringToHex(p.uri);
    return this.submit(asTx(obj));
  }

  /** Subject-side acceptance of a credential (not on the base gateway interface, but needed to complete the flow). */
  async acceptCredential(p: AcceptCredentialParams): Promise<TxResult> {
    const wallet = this.ensureWallet();
    this.assertAddress(p.issuer);
    return this.submit(
      asTx({
        TransactionType: 'CredentialAccept',
        Account: wallet.classicAddress,
        Issuer: p.issuer,
        CredentialType: this.credentialTypeHex(p.credentialType),
      }),
    );
  }

  async verifyCredential(p: VerifyCredentialParams): Promise<boolean> {
    this.ensureWallet();
    this.assertAddress(p.subject);
    this.assertAddress(p.issuer);
    const typeHex = this.credentialTypeHex(p.credentialType).toUpperCase();
    const requireAccepted = p.requireAccepted ?? true;
    const resp = await this.client.request({
      command: 'account_objects',
      account: p.subject,
      type: 'credential',
    });
    const objects = (resp.result.account_objects ?? []) as unknown as Array<
      Record<string, unknown>
    >;
    for (const obj of objects) {
      if (String(obj.Issuer) !== p.issuer) continue;
      if (String(obj.CredentialType).toUpperCase() !== typeHex) continue;
      if (requireAccepted && (Number(obj.Flags ?? 0) & LSF_ACCEPTED) === 0) return false;
      return true;
    }
    return false;
  }

  // ----- XLS-80 Permissioned Domains -----

  async setupPermissionedDomain(p: DomainParams): Promise<DomainId> {
    const wallet = this.ensureWallet();
    const accepted = p.acceptedCredentialTypes.map((t) => ({
      Credential: { Issuer: wallet.classicAddress, CredentialType: this.credentialTypeHex(t) },
    }));
    const resp = await this.submitRaw(
      asTx({
        TransactionType: 'PermissionedDomainSet',
        Account: wallet.classicAddress,
        AcceptedCredentials: accepted,
      }),
    );
    const meta = resp.result.meta;
    if (meta && typeof meta === 'object' && 'AffectedNodes' in meta) {
      const nodes = (meta as { AffectedNodes?: unknown[] }).AffectedNodes ?? [];
      for (const node of nodes) {
        const created = (
          node as { CreatedNode?: { LedgerEntryType?: string; LedgerIndex?: string } }
        ).CreatedNode;
        if (created?.LedgerEntryType === 'PermissionedDomain' && created.LedgerIndex) {
          return created.LedgerIndex;
        }
      }
    }
    return this.toTxResult(resp).hash;
  }

  // ----- Attestations (hash only) -----

  async writeAttestation(a: AttestationInput): Promise<TxResult> {
    const wallet = this.ensureWallet();
    const payload = buildAttestationPayload(a); // guards: hash + pseudonymous fields only
    const memo = encodeAttestationMemo(payload);
    return this.submit(
      asTx({ TransactionType: 'AccountSet', Account: wallet.classicAddress, Memos: [memo] }),
    );
  }

  async verifyAttestation(proof: AttestationProof): Promise<boolean> {
    this.ensureWallet();
    const resp = await this.client.request({ command: 'tx', transaction: proof.txHash });
    const result = resp.result as unknown as Record<string, unknown>;
    const txJson = result.tx_json as Record<string, unknown> | undefined;
    const memos = (result.Memos ?? txJson?.Memos) as
      | readonly { Memo?: { MemoType?: string; MemoData?: string } }[]
      | undefined;
    const payload = decodeAttestationMemo(memos);
    if (!payload) return false;
    return payload.sha256.toLowerCase() === proof.sha256.toLowerCase();
  }

  // ----- XLS-56 Batch -----

  async submitBatch(txns: SubmittableTx[]): Promise<TxResult> {
    const wallet = this.ensureWallet();
    if (txns.length === 0) {
      throw new XrplError('submitBatch requires at least one transaction', 'BATCH_EMPTY');
    }
    const rawTransactions = txns.map((t) => {
      const payload = buildAttestationPayload(t); // each bundled item is hash-guarded
      const memo = encodeAttestationMemo(payload);
      return {
        RawTransaction: asTx({
          TransactionType: 'AccountSet',
          Account: wallet.classicAddress,
          Memos: [memo],
          Flags: TF_INNER_BATCH_TXN,
          Fee: '0',
          SigningPubKey: '',
        }),
      };
    });
    try {
      return await this.submit(
        asTx({
          TransactionType: 'Batch',
          Account: wallet.classicAddress,
          Flags: TF_ALL_OR_NOTHING,
          RawTransactions: rawTransactions,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/batch|amendment|disabled|not enabled|unknown transaction type/i.test(msg)) {
        throw new BatchUnsupportedError(msg);
      }
      throw err;
    }
  }

  // ----- internals -----

  private async submit(transaction: SubmittableTransaction): Promise<TxResult> {
    return this.toTxResult(await this.submitRaw(transaction));
  }

  private async submitRaw(transaction: SubmittableTransaction): Promise<SubmitResponse> {
    const wallet = this.ensureWallet();
    return this.client.submitAndWait(transaction, { wallet, autofill: true });
  }

  private toTxResult(resp: SubmitResponse): TxResult {
    const r = resp.result as unknown as Record<string, unknown>;
    const meta = r.meta;
    const engineResult =
      meta && typeof meta === 'object' && 'TransactionResult' in meta
        ? String((meta as Record<string, unknown>).TransactionResult)
        : 'unknown';
    const base = { hash: String(r.hash ?? ''), validated: r.validated === true, engineResult };
    return typeof r.ledger_index === 'number' ? { ...base, ledgerIndex: r.ledger_index } : base;
  }

  private ensureWallet(): Wallet {
    if (!this.wallet) throw new NotConnectedError();
    return this.wallet;
  }

  private assertAddress(addr: string): void {
    if (!isValidClassicAddress(addr)) {
      throw new XrplError(`Invalid XRPL classic address: ${addr}`, 'INVALID_ADDRESS');
    }
  }

  private credentialTypeHex(label: string): string {
    const hex = convertStringToHex(label);
    if (hex.length / 2 > CREDENTIAL_TYPE_MAX_BYTES) {
      throw new XrplError('CredentialType exceeds 64 bytes', 'CREDENTIAL_TYPE_TOO_LONG');
    }
    return hex;
  }
}
