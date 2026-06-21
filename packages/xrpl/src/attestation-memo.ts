import { PiiOnChainBlocked } from './errors';
import { assertIsHash } from './guards';
import type { AttestationInput } from './types';

export const ATTESTATION_MEMO_TYPE = 'tuitionflow/attestation/v1';

// Local hex helpers (uppercase, matching xrpl.js convention) — keeps this pure module free of any
// SDK import, so the security tests load instantly and never pull the XRPL client into scope.
function stringToHex(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex').toUpperCase();
}
function hexToString(value: string): string {
  return Buffer.from(value, 'hex').toString('utf8');
}

export interface AttestationMemoPayload {
  readonly v: 1;
  readonly caseId: string;
  readonly milestone: string;
  readonly sha256: string;
  readonly ts: string;
}

/** Structural memo shape (no xrpl types leak into signatures). */
interface RawMemoEntry {
  readonly Memo?: {
    readonly MemoType?: string;
    readonly MemoData?: string;
    readonly MemoFormat?: string;
  };
}

// Defensive shapes: a case id must look pseudonymous and a milestone like an upper-snake token.
// Anything outside these (e.g. an email or a name with spaces/@) is rejected as potential PII.
const PSEUDONYMOUS_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const MILESTONE_TOKEN = /^[A-Z_]{1,40}$/;

/**
 * Build (and fully validate) the only payload allowed on-chain: a digest plus pseudonymous
 * metadata. Throws PiiOnChainBlocked if any field could carry PII.
 */
export function buildAttestationPayload(input: AttestationInput): AttestationMemoPayload {
  assertIsHash(input.sha256);
  if (!PSEUDONYMOUS_ID.test(input.caseId)) {
    throw new PiiOnChainBlocked(input.caseId);
  }
  if (!MILESTONE_TOKEN.test(input.milestone)) {
    throw new PiiOnChainBlocked(input.milestone);
  }
  return {
    v: 1,
    caseId: input.caseId,
    milestone: input.milestone,
    sha256: input.sha256.toLowerCase(),
    ts: input.occurredAt ?? new Date().toISOString(),
  };
}

export function encodeAttestationMemo(payload: AttestationMemoPayload): RawMemoEntry {
  return {
    Memo: {
      MemoType: stringToHex(ATTESTATION_MEMO_TYPE),
      MemoData: stringToHex(JSON.stringify(payload)),
    },
  };
}

export function decodeAttestationMemo(
  memos: readonly RawMemoEntry[] | undefined,
): AttestationMemoPayload | undefined {
  if (!memos) return undefined;
  const typeHex = stringToHex(ATTESTATION_MEMO_TYPE);
  for (const entry of memos) {
    const memo = entry.Memo;
    if (!memo?.MemoData) continue;
    if (memo.MemoType && memo.MemoType.toUpperCase() !== typeHex) continue;
    try {
      const parsed = JSON.parse(hexToString(memo.MemoData)) as AttestationMemoPayload;
      if (parsed && typeof parsed.sha256 === 'string') return parsed;
    } catch {
      // not our memo / not JSON — keep scanning
    }
  }
  return undefined;
}
