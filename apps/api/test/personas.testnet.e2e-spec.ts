import 'reflect-metadata';
import { createHmac } from 'node:crypto';

process.env.PERSISTENCE = 'memory';
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
process.env.PARTNER_WEBHOOK_HMAC_SECRET = 'test-secret';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { XrplClient } from '@tuitionflow/xrpl';
import request from 'supertest';
import { Client } from 'xrpl';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

const WSS = process.env.XRPL_WSS ?? 'wss://s.altnet.rippletest.net:51233';

function sign(body: string): string {
  return createHmac('sha256', 'test-secret').update(body).digest('hex');
}

function deadline(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

interface Persona {
  student: string;
  lender: string;
  beneficiary: string;
  amountMinor: string;
  mode: 'INTEGRATED' | 'DIRECT';
}

describe('Personas on Testnet — real on-chain attestations', () => {
  let app: INestApplication | undefined;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let verifier: XrplClient | undefined;
  let online = false;

  beforeAll(async () => {
    try {
      // Fund an issuer wallet from the faucet and point the API at it.
      const funder = new Client(WSS);
      await Promise.race([funder.connect(), deadline(60_000)]);
      const funded = await funder.fundWallet();
      await funder.disconnect();

      process.env.XRPL_ENABLED = 'true';
      process.env.XRPL_ISSUER_SEED = funded.wallet.seed;

      verifier = new XrplClient({ wss: WSS });
      await verifier.connect();

      const { AppModule } = await import('../src/app.module');
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication({ rawBody: true });
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      app.useGlobalFilters(new DomainExceptionFilter());
      await app.init();
      http = app.getHttpServer();
      online = true;
    } catch (err) {
      console.warn(`[personas] Skipping — Testnet/boot unavailable: ${(err as Error).message}`);
    }
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await verifier?.disconnect().catch(() => undefined);
  });

  async function runPersona(p: Persona): Promise<void> {
    const created = await request(http)
      .post('/cases')
      .send({
        studentId: p.student,
        lenderId: p.lender,
        beneficiaryId: p.beneficiary,
        amountMinor: p.amountMinor,
        currency: 'INR',
        mode: p.mode,
        funding: 'LOAN',
      })
      .expect(201);
    const caseId = created.body.id as string;

    await request(http)
      .post(`/cases/${caseId}/documents`)
      .send({ documents: ['kyc'] })
      .expect(201);
    await request(http).post(`/cases/${caseId}/validate`).expect(201);
    await request(http).post(`/cases/${caseId}/quote`).expect(201);
    const initiated = await request(http)
      .post(`/cases/${caseId}/initiate`)
      .set('Idempotency-Key', `persona-${caseId}`)
      .expect(201);
    const paymentId = initiated.body.paymentRef.paymentId as string;

    const payload = JSON.stringify({ caseId, paymentId, status: 'SETTLED' });
    const settled = await request(http)
      .post('/webhooks/partner')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(payload))
      .send(payload)
      .expect(200);
    expect(settled.body.status).toBe('RECONCILED');

    // State path
    const detail = await request(http).get(`/cases/${caseId}`).expect(200);
    const events = detail.body.timeline.map((t: { event: string }) => t.event);
    expect(events).toEqual(
      expect.arrayContaining(['CaseValidated', 'QuoteLocked', 'PaymentSettled', 'CaseReconciled']),
    );

    // Every milestone is anchored on-chain and verifiable
    const att = await request(http).get(`/admin/attestations/${caseId}`).expect(200);
    const records = att.body as Array<{ milestone: string; sha256: string; txHash?: string }>;
    expect(records.map((r) => r.milestone).sort()).toEqual([
      'PAID',
      'QUOTE_LOCKED',
      'RECONCILED',
      'VALIDATED',
    ]);
    for (const r of records) {
      expect(r.txHash).toMatch(/^[A-F0-9]{64}$/);
      const ok = await verifier!.verifyAttestation({
        txHash: r.txHash as string,
        sha256: r.sha256,
      });
      expect(ok).toBe(true);
    }
  }

  it('Persona A — integrated, SBI, UK/GBP', async () => {
    if (!online) return;
    await runPersona({
      student: 'student-a',
      lender: 'lender-sbi',
      beneficiary: 'uni-oxford',
      amountMinor: '100000000',
      mode: 'INTEGRATED',
    });
  }, 180_000);

  it('Persona B — direct, NBFC, US/USD', async () => {
    if (!online) return;
    await runPersona({
      student: 'student-b',
      lender: 'lender-nbfc',
      beneficiary: 'uni-mit',
      amountMinor: '150000000',
      mode: 'DIRECT',
    });
  }, 180_000);
});
