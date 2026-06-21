import { redactSecrets } from './redacting-logger';

describe('redactSecrets (no PII/secrets in logs)', () => {
  it('redacts email addresses', () => {
    const out = redactSecrets('student aarav.sharma@example.com created a case');
    expect(out).not.toContain('aarav.sharma@example.com');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts a PAN', () => {
    expect(redactSecrets('PAN ABCDE1234F on file')).not.toContain('ABCDE1234F');
  });

  it('redacts seed/secret/key assignments without leaking the value', () => {
    const out = redactSecrets('connecting with seed=sEdSomeWalletSeedValue123');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('sEdSomeWalletSeedValue123');
  });

  it('redacts fields inside an object payload', () => {
    const out = redactSecrets({ who: 'diya.patel@example.com' });
    expect(out).not.toContain('diya.patel@example.com');
  });
});
