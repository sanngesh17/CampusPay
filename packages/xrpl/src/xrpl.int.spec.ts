import { createHash } from 'node:crypto';
import { BatchUnsupportedError } from './errors';
import { XrplClient } from './XrplClient';

/**
 * Testnet integration tests. They run for real against the public XRPL Testnet (faucet-funded
 * ephemeral wallets) and SKIP CLEANLY when the network is unreachable, so a local run never depends
 * on connectivity. Run with: pnpm --filter @tuitionflow/xrpl test:integration
 */
const WSS = process.env.XRPL_WSS ?? 'wss://s.altnet.rippletest.net:51233';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('@tuitionflow/xrpl — Testnet integration', () => {
  let issuer: XrplClient;
  let subject: XrplClient;
  let online = false;

  beforeAll(async () => {
    issuer = new XrplClient({ wss: WSS });
    subject = new XrplClient({ wss: WSS });
    try {
      await Promise.race([
        (async () => {
          await issuer.connect();
          await subject.connect();
        })(),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('connect/fund timeout')), 100_000),
        ),
      ]);
      online = true;
    } catch (err) {
      console.warn(`[xrpl int] Skipping — Testnet unreachable: ${(err as Error).message}`);
    }
  }, 120_000);

  afterAll(async () => {
    await issuer?.disconnect().catch(() => undefined);
    await subject?.disconnect().catch(() => undefined);
  });

  it('issues, accepts, and verifies a credential (XLS-70)', async () => {
    if (!online) return;
    const credentialType = 'LENDER_VETTED';

    await issuer.issueCredential({ subject: subject.address, credentialType });
    expect(
      await issuer.verifyCredential({
        subject: subject.address,
        issuer: issuer.address,
        credentialType,
        requireAccepted: true,
      }),
    ).toBe(false);

    await subject.acceptCredential({ issuer: issuer.address, credentialType });
    expect(
      await issuer.verifyCredential({
        subject: subject.address,
        issuer: issuer.address,
        credentialType,
        requireAccepted: true,
      }),
    ).toBe(true);
  }, 120_000);

  it('writes and verifies an attestation (hash only)', async () => {
    if (!online) return;
    const digest = sha256('case_42|PAID|2026-06-20');

    const res = await issuer.writeAttestation({
      caseId: 'case_42',
      milestone: 'PAID',
      sha256: digest,
    });
    expect(res.validated).toBe(true);
    expect(res.engineResult).toBe('tesSUCCESS');
    expect(res.hash).toMatch(/^[A-F0-9]{64}$/);

    expect(await issuer.verifyAttestation({ txHash: res.hash, sha256: digest })).toBe(true);
    expect(await issuer.verifyAttestation({ txHash: res.hash, sha256: sha256('different') })).toBe(
      false,
    );
  }, 120_000);

  it('submits an atomic batch of attestations (XLS-56)', async () => {
    if (!online) return;
    try {
      const res = await issuer.submitBatch([
        { caseId: 'case_42', milestone: 'VALIDATED', sha256: sha256('case_42|VALIDATED') },
        { caseId: 'case_42', milestone: 'RECEIPT', sha256: sha256('case_42|RECEIPT') },
      ]);
      expect(res.validated).toBe(true);
      expect(res.engineResult).toBe('tesSUCCESS');
    } catch (err) {
      if (err instanceof BatchUnsupportedError) {
        console.warn(`[xrpl int] Batch unsupported here: ${err.message}`);
        return;
      }
      throw err;
    }
  }, 120_000);

  it('refuses to anchor PII on-chain', async () => {
    if (!online) return;
    await expect(
      issuer.writeAttestation({
        caseId: 'case_1',
        milestone: 'PAID',
        sha256: 'student@example.com',
      }),
    ).rejects.toThrow();
  });
});
