/**
 * Public DTOs for the gateway. Deliberately framework- and SDK-agnostic: NO `xrpl.js` types
 * appear here or anywhere in the public surface (index.ts), so the package boundary stays clean.
 */

export interface TxResult {
  /** Validated transaction hash. */
  readonly hash: string;
  readonly validated: boolean;
  /** Engine result code, e.g. 'tesSUCCESS'. */
  readonly engineResult: string;
  readonly ledgerIndex?: number;
}

export interface AttestationInput {
  /** Pseudonymous case id — never a name, email, or other PII. */
  readonly caseId: string;
  /** Milestone token, e.g. 'VALIDATED' | 'QUOTE_LOCKED' | 'PAID' | 'RECONCILED' | 'RECEIPT'. */
  readonly milestone: string;
  /** 64-char sha256 hex digest of the finalised milestone payload. */
  readonly sha256: string;
  /** ISO-8601 timestamp; defaults to now. */
  readonly occurredAt?: string;
}

/** A single item that can be bundled in a batch — every bundled item is a hash-guarded memo. */
export type SubmittableTx = AttestationInput;

export interface AttestationProof {
  readonly txHash: string;
  /** The digest the caller expects to find anchored. */
  readonly sha256: string;
}

export interface IssueCredentialParams {
  /** Holder XRPL classic address. */
  readonly subject: string;
  /** Human-readable credential label (hex-encoded internally), e.g. 'LENDER_VETTED'. */
  readonly credentialType: string;
  /** Optional expiry in Ripple time (seconds since 2000-01-01 UTC). */
  readonly expirationRippleTime?: number;
  /** Optional URI pointer (hex-encoded internally) — must not contain PII. */
  readonly uri?: string;
}

export interface AcceptCredentialParams {
  /** Issuer XRPL classic address. */
  readonly issuer: string;
  readonly credentialType: string;
}

export interface VerifyCredentialParams {
  readonly subject: string;
  readonly issuer: string;
  readonly credentialType: string;
  /** Require the credential to be accepted by the subject (default true). */
  readonly requireAccepted?: boolean;
}

export interface DomainParams {
  /** Credential type labels (issued by this gateway's account) admitted to the domain. */
  readonly acceptedCredentialTypes: string[];
}

export type DomainId = string;

export interface XrplClientConfig {
  /** WebSocket endpoint, e.g. wss://s.altnet.rippletest.net:51233. */
  readonly wss: string;
  /** Wallet seed (from env/KMS). If omitted, connect() funds an ephemeral wallet via faucet (tests only). */
  readonly seed?: string;
}
