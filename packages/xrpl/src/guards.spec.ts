import { PiiOnChainBlocked } from './errors';
import { assertIsHash, isHash } from './guards';

const validHash = 'a'.repeat(64);

describe('hash guard — the no-PII-on-chain rule', () => {
  it('accepts a 64-char hex digest (case-insensitive)', () => {
    expect(isHash(validHash)).toBe(true);
    expect(() => assertIsHash(validHash)).not.toThrow();
    expect(() => assertIsHash('A'.repeat(64))).not.toThrow();
    expect(() => assertIsHash('0123456789abcdef'.repeat(4))).not.toThrow();
  });

  it('rejects anything that is not a 64-hex digest', () => {
    const bad = [
      'student@example.com',
      'John Doe',
      'a'.repeat(63),
      'a'.repeat(65),
      'g'.repeat(64),
      '',
      '1234',
    ];
    for (const value of bad) {
      expect(isHash(value)).toBe(false);
      expect(() => assertIsHash(value)).toThrow(PiiOnChainBlocked);
    }
  });

  it('never echoes the offending value in the error message', () => {
    const secret = 'pan-ABCDE1234F';
    expect.assertions(2);
    try {
      assertIsHash(secret);
    } catch (err) {
      expect(err).toBeInstanceOf(PiiOnChainBlocked);
      expect((err as Error).message).not.toContain(secret);
    }
  });
});
