import {
  buildAttestationPayload,
  decodeAttestationMemo,
  encodeAttestationMemo,
} from './attestation-memo';
import { PiiOnChainBlocked } from './errors';

const hash = 'b'.repeat(64);

describe('attestation memo — PII guard + round-trip', () => {
  it('builds a payload for a valid hash and pseudonymous fields', () => {
    const p = buildAttestationPayload({ caseId: 'case_123', milestone: 'PAID', sha256: hash });
    expect(p.sha256).toBe(hash);
    expect(p.milestone).toBe('PAID');
    expect(p.v).toBe(1);
    expect(typeof p.ts).toBe('string');
  });

  it('rejects a non-hash digest', () => {
    expect(() =>
      buildAttestationPayload({ caseId: 'case_1', milestone: 'PAID', sha256: 'not-a-hash' }),
    ).toThrow(PiiOnChainBlocked);
  });

  it('rejects a caseId that could be PII (e.g. an email)', () => {
    expect(() =>
      buildAttestationPayload({ caseId: 'john@doe.com', milestone: 'PAID', sha256: hash }),
    ).toThrow(PiiOnChainBlocked);
  });

  it('rejects a free-text milestone', () => {
    expect(() =>
      buildAttestationPayload({ caseId: 'case_1', milestone: 'paid by John', sha256: hash }),
    ).toThrow(PiiOnChainBlocked);
  });

  it('round-trips through encode/decode', () => {
    const p = buildAttestationPayload({
      caseId: 'case_9',
      milestone: 'RECONCILED',
      sha256: hash,
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    const decoded = decodeAttestationMemo([encodeAttestationMemo(p)]);
    expect(decoded).toEqual(p);
  });

  it('decode ignores unrelated or missing memos', () => {
    expect(decodeAttestationMemo([{ Memo: { MemoData: '00' } }])).toBeUndefined();
    expect(decodeAttestationMemo(undefined)).toBeUndefined();
    expect(decodeAttestationMemo([])).toBeUndefined();
  });
});
