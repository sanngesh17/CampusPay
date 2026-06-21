import 'reflect-metadata';
import { createHmac } from 'node:crypto';

// Configure the app for a self-contained run BEFORE the module is compiled.
process.env.PERSISTENCE = 'memory';
process.env.XRPL_ENABLED = 'false';
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.PARTNER_WEBHOOK_HMAC_SECRET = 'test-secret';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FieldCipher } from '../src/common/crypto/field-cipher';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { AppModule } from '../src/app.module';
import type { StudentRepository } from '../src/persistence/ports';
import { FIELD_CIPHER, STUDENT_REPOSITORY } from '../src/tokens';

const HMAC_SECRET = 'test-secret';

function sign(body: string): string {
  return createHmac('sha256', HMAC_SECRET).update(body).digest('hex');
}

function partnerHeaders(body: string, nonce: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature': createHmac('sha256', HMAC_SECRET)
      .update(`${timestamp}.${nonce}.`)
      .update(body)
      .digest('hex'),
  };
}

describe('TuitionFlow API (e2e — mock rail, no DB, no network)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a health endpoint', async () => {
    const res = await request(http).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('rotates an HttpOnly refresh session and logs it out', async () => {
    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: 'student@tuitionflow.local', password: 'DemoPass123!' })
      .expect(201);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    expect(cookie.join(';')).toContain('HttpOnly');
    const refreshed = await request(http)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(201);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const rotated = refreshed.headers['set-cookie'] as unknown as string[];
    await request(http).post('/api/auth/logout').set('Cookie', rotated).expect(201);
    await request(http).post('/api/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('Persona A (integrated, SBI, UK/GBP): drives a case to RECONCILED with 0% TCS and 4 attestations', async () => {
    // 1. Create
    const created = await request(http)
      .post('/cases')
      .send({
        studentId: 'student-a',
        lenderId: 'lender-sbi',
        beneficiaryId: 'uni-oxford',
        amountMinor: '100000000', // ₹10,00,000
        currency: 'INR',
        mode: 'INTEGRATED',
        funding: 'LOAN',
        reference: 'OX-123456',
      })
      .expect(201);
    const caseId = created.body.id as string;
    expect(created.body.status).toBe('CASE_CREATED');

    // 2. Documents -> 3. Validate -> 4. Quote
    await request(http)
      .post(`/cases/${caseId}/documents`)
      .send({ documents: ['kyc-passport', 'loan-sanction', 'invoice'] })
      .expect(201);
    await request(http).post(`/cases/${caseId}/validate`).expect(201);

    const quoted = await request(http).post(`/cases/${caseId}/quote`).expect(201);
    expect(quoted.body.status).toBe('QUOTE_LOCKED');
    expect(quoted.body.rail).toBe('A');
    expect(quoted.body.quote.tcsMinor).toBe('0'); // 0% TCS for loan-funded
    expect(quoted.body.quote.fxRate).toContain('0.0095'); // INR->GBP

    // 5. Initiate (idempotent)
    const first = await request(http)
      .post(`/cases/${caseId}/initiate`)
      .set('Idempotency-Key', 'key-1')
      .expect(201);
    expect(first.body.status).toBe('IN_SETTLEMENT');
    expect(first.body.idempotent).toBe(false);
    const paymentId = first.body.paymentRef.paymentId as string;

    // 6. Retry initiate with same key -> no duplicate payment
    const retry = await request(http)
      .post(`/cases/${caseId}/initiate`)
      .set('Idempotency-Key', 'key-1')
      .expect(201);
    expect(retry.body.idempotent).toBe(true);
    expect(retry.body.paymentRef.paymentId).toBe(paymentId);

    // 7. Partner webhook (HMAC) -> settle + reconcile
    const payload = JSON.stringify({ caseId, paymentId, status: 'SETTLED' });
    const settled = await request(http)
      .post('/webhooks/partner')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(payload))
      .send(payload)
      .expect(200);
    expect(settled.body.status).toBe('RECONCILED');

    // 8. Status timeline
    const detail = await request(http).get(`/cases/${caseId}`).expect(200);
    expect(detail.body.status).toBe('RECONCILED');
    const events = detail.body.timeline.map((t: { event: string }) => t.event);
    expect(events).toEqual(
      expect.arrayContaining([
        'CaseCreated',
        'CaseValidated',
        'QuoteLocked',
        'CaseFunded',
        'PaymentSettled',
        'CaseReconciled',
      ]),
    );

    // 9. Attestations at the four milestones, each a 64-hex hash
    const att = await request(http).get(`/admin/attestations/${caseId}`).expect(200);
    const milestones = att.body.map((a: { milestone: string }) => a.milestone).sort();
    expect(milestones).toEqual(['PAID', 'QUOTE_LOCKED', 'RECONCILED', 'VALIDATED']);
    for (const a of att.body) {
      expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
    }

    // 10. Receipt
    const receipt = await request(http).get(`/cases/${caseId}/receipt`).expect(200);
    expect(receipt.body.proofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.body.rail).toBe('A');
  });

  it('Persona B (direct, NBFC, US/USD): quotes a DIRECT case with 0% TCS', async () => {
    const created = await request(http)
      .post('/cases')
      .send({
        studentId: 'student-b',
        lenderId: 'lender-nbfc',
        beneficiaryId: 'uni-mit',
        amountMinor: '250000000', // ₹25,00,000 (at the cap)
        currency: 'INR',
        mode: 'DIRECT',
        funding: 'LOAN',
        reference: 'MIT-654321',
      })
      .expect(201);
    const caseId = created.body.id as string;

    await request(http)
      .post(`/cases/${caseId}/documents`)
      .send({ documents: ['kyc'] })
      .expect(201);
    await request(http).post(`/cases/${caseId}/validate`).expect(201);
    const quoted = await request(http).post(`/cases/${caseId}/quote`).expect(201);
    expect(quoted.body.status).toBe('QUOTE_LOCKED');
    expect(quoted.body.quote.tcsMinor).toBe('0');
    expect(quoted.body.quote.fxRate).toContain('0.012'); // INR->USD
  });

  it('rejects initiate without an Idempotency-Key (400)', async () => {
    const created = await request(http)
      .post('/cases')
      .send({
        studentId: 'student-a',
        lenderId: 'lender-sbi',
        beneficiaryId: 'uni-oxford',
        amountMinor: '5000000',
        currency: 'INR',
        mode: 'INTEGRATED',
        funding: 'LOAN',
      })
      .expect(201);
    const caseId = created.body.id as string;
    await request(http)
      .post(`/cases/${caseId}/documents`)
      .send({ documents: ['k'] })
      .expect(201);
    await request(http).post(`/cases/${caseId}/validate`).expect(201);
    await request(http).post(`/cases/${caseId}/quote`).expect(201);
    await request(http).post(`/cases/${caseId}/initiate`).expect(400);
  });

  it('rejects a webhook with a bad HMAC signature (401)', async () => {
    const payload = JSON.stringify({ caseId: 'x', paymentId: 'y', status: 'SETTLED' });
    await request(http)
      .post('/webhooks/partner')
      .set('Content-Type', 'application/json')
      .set('x-signature', 'deadbeef')
      .send(payload)
      .expect(401);
  });

  it('rejects an illegal transition (validate before documents) with 409', async () => {
    const created = await request(http)
      .post('/cases')
      .send({
        studentId: 'student-a',
        lenderId: 'lender-sbi',
        beneficiaryId: 'uni-oxford',
        amountMinor: '5000000',
        currency: 'INR',
        mode: 'INTEGRATED',
        funding: 'LOAN',
      })
      .expect(201);
    await request(http).post(`/cases/${created.body.id}/quote`).expect(409);
  });

  it('drives a case to RECONCILED via the demo settle endpoint and lists it in admin (UI path)', async () => {
    const created = await request(http)
      .post('/cases')
      .send({
        studentId: 'student-a',
        lenderId: 'lender-sbi',
        beneficiaryId: 'uni-oxford',
        amountMinor: '100000000',
        currency: 'INR',
        mode: 'INTEGRATED',
        funding: 'LOAN',
      })
      .expect(201);
    const id = created.body.id as string;
    await request(http)
      .post(`/cases/${id}/documents`)
      .send({ documents: ['k'] })
      .expect(201);
    await request(http).post(`/cases/${id}/validate`).expect(201);
    await request(http).post(`/cases/${id}/quote`).expect(201);
    await request(http).post(`/cases/${id}/initiate`).set('Idempotency-Key', 'demo-1').expect(201);

    const settled = await request(http).post(`/cases/${id}/settle`).expect(200);
    expect(settled.body.status).toBe('RECONCILED');

    const admin = await request(http).get('/admin/cases').expect(200);
    const found = (
      admin.body as Array<{ id: string; status: string; attestationCount: number }>
    ).find((c) => c.id === id);
    expect(found).toBeDefined();
    expect(found?.status).toBe('RECONCILED');
    expect(found?.attestationCount).toBeGreaterThanOrEqual(4);
  });

  it('stores student PII encrypted at rest (ciphertext, decryptable)', async () => {
    const repo = app.get<StudentRepository>(STUDENT_REPOSITORY);
    const cipher = app.get<FieldCipher>(FIELD_CIPHER);
    const student = await repo.findById('student-a');
    expect(student).not.toBeNull();
    expect(student?.panCipher).toBeDefined();
    expect(FieldCipher.isCiphertext(student!.panCipher as string)).toBe(true);
    expect(student?.panCipher).not.toContain('ABCDE1234F');
    expect(cipher.decrypt(student!.panCipher as string)).toBe('ABCDE1234F');
  });

  it('runs the compliance-ready student -> lender -> operations -> student journey', async () => {
    async function token(email: string): Promise<string> {
      const response = await request(http)
        .post('/api/auth/login')
        .send({ email, password: 'DemoPass123!' })
        .expect(201);
      return response.body.accessToken as string;
    }
    const studentToken = await token('student@tuitionflow.local');
    const lenderToken = await token('lender@tuitionflow.local');
    const opsToken = await token('ops@tuitionflow.local');

    const created = await request(http)
      .post('/api/cases')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        fundingType: 'FULL_LOAN',
        amountMinor: '100000000',
        lenderAmountMinor: '100000000',
        lenderId: 'lender-sbi',
        lenderName: 'State Bank of India',
        branchName: 'SBI RACPC',
        loanAccountNumber: 'EDU-001',
        sanctionReference: 'SANCTION-001',
        universityName: 'University of Warwick',
        destinationCountry: 'United Kingdom',
        targetCurrency: 'GBP',
        targetAmountMinor: '1000000',
        feeBreakdown: {
          tuitionAdvanceMinor: '1000000',
          courseDepositMinor: '0',
          accommodationMinor: '0',
          otherMinor: '0',
        },
        providerName: 'State Bank of India',
        providerType: 'BANK',
        studentEmail: 'student@tuitionflow.local',
        firstName: 'Aarav',
        familyName: 'Sharma',
        pinCode: '560001',
        addressLine1: '12 Residency Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        phone: '9876543210',
        payerName: 'Raj Sharma',
        payerRelationship: 'Parent',
        payerPan: 'ABCDE1234F',
      })
      .expect(201);
    const id = created.body.id as string;

    await request(http)
      .post(`/api/cases/${id}/documents`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', Buffer.from('%PDF-1.4 synthetic evidence'), {
        filename: 'sanction.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const submitted = await request(http)
      .post(`/api/cases/${id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);
    expect(submitted.body.status).toBe('FUNDING_PENDING');
    expect(submitted.body.compliance.outcome).toBe('APPROVED');

    await request(http)
      .post(`/api/lender/cases/${id}/decision`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ decision: 'APPROVE' })
      .expect(201);
    const funded = await request(http)
      .post(`/api/lender/cases/${id}/funding`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ kind: 'LENDER', transferReference: 'UTR-LENDER-001' })
      .expect(201);
    expect(funded.body.status).toBe('FUNDS_RECEIVED');

    await request(http)
      .post(`/api/operations/cases/${id}/quote`)
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(201);
    await request(http)
      .post(`/api/operations/cases/${id}/payout`)
      .set('Authorization', `Bearer ${opsToken}`)
      .set('Idempotency-Key', 'journey-1')
      .expect(201);
    async function webhook(eventId: string, status: string, nonce: string, expected = 200) {
      const payload = JSON.stringify({ caseId: id, eventId, status });
      return request(http)
        .post('/api/webhooks/payments-direct')
        .set('Content-Type', 'application/json')
        .set(partnerHeaders(payload, nonce))
        .send(payload)
        .expect(expected);
    }
    await webhook('event-out-of-order', 'COMPLETED', 'nonce-out-of-order', 409);
    await webhook('event-validating', 'VALIDATING', 'nonce-validating');
    const duplicate = await webhook('event-validating', 'VALIDATING', 'nonce-validating-duplicate');
    expect(duplicate.body.duplicate).toBe(true);
    await webhook('event-transferring', 'TRANSFERRING', 'nonce-transferring');
    await webhook('event-completed', 'COMPLETED', 'nonce-completed');
    await request(http)
      .post(`/api/operations/cases/${id}/reconcile`)
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(201);

    const reflected = await request(http)
      .get(`/api/cases/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(reflected.body.status).toBe('RECONCILED');
    expect(reflected.body.payment.status).toBe('COMPLETED');
    const instructionOne = await request(http)
      .get(`/api/cases/${id}/instruction`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect('Content-Type', /pdf/);
    const instructionTwo = await request(http)
      .get(`/api/cases/${id}/instruction`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(instructionOne.body).toEqual(instructionTwo.body);
    await request(http)
      .get(`/api/cases/${id}/receipt`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect('Content-Type', /pdf/);

    const accessRequest = await request(http)
      .post(`/api/cases/${id}/privacy-requests`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'ACCESS', details: 'Please provide a copy of my payment case data.' })
      .expect(201);
    expect(accessRequest.body.privacyRequests[0].status).toBe('OPEN');
    const personalExport = await request(http)
      .get(`/api/cases/${id}/privacy-export`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect('Content-Type', /json/);
    expect(personalExport.body.personalDetails.payerPan).toBe('ABCDE1234F');
    const erasureRequest = await request(http)
      .post(`/api/cases/${id}/privacy-requests`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'ERASURE', details: 'Please erase personal data that is no longer required.' })
      .expect(201);
    const erasureId = erasureRequest.body.privacyRequests.find(
      (item: { type: string }) => item.type === 'ERASURE',
    ).id as string;
    await request(http)
      .post(`/api/operations/cases/${id}/legal-hold`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ active: true, reason: 'Regulatory transaction record preservation' })
      .expect(201);
    await request(http)
      .post(`/api/operations/cases/${id}/privacy-requests/${erasureId}/resolve`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ decision: 'COMPLETED', outcome: 'Erasure completed after review.' })
      .expect(409);
    await request(http)
      .post(`/api/operations/cases/${id}/privacy-requests/${erasureId}/resolve`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        decision: 'DECLINED',
        outcome: 'Regulated transaction records must currently be retained.',
      })
      .expect(201);
    const retention = await request(http)
      .post('/api/operations/cases/retention/run')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ cutoffBefore: '2099-01-01T00:00:00.000Z' })
      .expect(201);
    expect(retention.body.held).toBeGreaterThanOrEqual(1);
    await request(http)
      .get('/api/operations/cases')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });
});
