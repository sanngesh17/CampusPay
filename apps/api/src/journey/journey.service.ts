import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { RemittanceCase, RemittanceStatus, type FundingLegKind } from '@tuitionflow/domain';
import { SimulatedCompliancePartner, SimulatedPaymentsDirect } from '@tuitionflow/rails';
import { FieldCipher } from '../common/crypto/field-cipher';
import type { PrivateStorage } from '../common/storage/private-storage';
import type { AppConfig } from '../config/app-config';
import { APP_CONFIG, FIELD_CIPHER, PRISMA_CLIENT, PRIVATE_STORAGE } from '../tokens';
import type { AuthUser } from '../auth/auth.types';
import type { CreateJourneyInput, JourneyCaseRecord, PrivacyRequestType } from './journey.types';

@Injectable()
export class JourneyService implements OnModuleInit {
  private readonly records = new Map<string, JourneyCaseRecord>();
  private readonly compliance = new SimulatedCompliancePartner();
  private readonly payments = new SimulatedPaymentsDirect();
  private readonly snapshotPath = join(process.cwd(), '.data', 'journeys.json');

  constructor(
    @Inject(FIELD_CIPHER) private readonly cipher: FieldCipher,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PRISMA_CLIENT) private readonly db: import('@prisma/client').PrismaClient | null,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.persistence === 'memory' && process.env.JEST_WORKER_ID) return;
    try {
      const rows =
        this.config.persistence === 'prisma' && this.db
          ? (await this.db.journeySnapshot.findMany()).map(
              (item) => JSON.parse(item.recordJson) as StoredJourneySnapshot,
            )
          : (JSON.parse(await readFile(this.snapshotPath, 'utf8')) as StoredJourneySnapshot[]);
      for (const row of rows) {
        const domain = RemittanceCase.rehydrate(
          {
            id: row.domain.id,
            studentId: row.domain.studentId,
            studentAge: 21,
            fundingType: row.domain.fundingType,
            sourceAmountMinor: BigInt(row.domain.sourceAmountMinor),
            currency: 'INR',
            lenderAmountMinor: BigInt(row.domain.lenderAmountMinor),
          },
          row.domain.status,
          row.domain.fundingLegs.map((leg) => ({
            ...leg,
            requiredMinor: BigInt(leg.requiredMinor),
            receivedMinor: BigInt(leg.receivedMinor),
          })),
        );
        this.records.set(domain.id, this.normalizeRecord({ ...row.record, domain }));
      }
      await this.cleanupDuplicateSemesterPayments();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async create(user: AuthUser, input: CreateJourneyInput) {
    const id = randomUUID();
    const universityName =
      user.role === 'STUDENT' && user.universityName ? user.universityName : input.universityName;
    const semesterLabel = input.semesterLabel ?? 'Semester 1';
    if (
      user.role === 'STUDENT' &&
      [...this.records.values()].some(
        (record) =>
          record.domain.studentId === user.id &&
          record.universityName === universityName &&
          record.semesterLabel === semesterLabel,
      )
    ) {
      throw new ConflictException('A payment already exists for this semester');
    }
    const domain = new RemittanceCase({
      id,
      studentId: user.id,
      studentAge: 21,
      fundingType: input.fundingType,
      sourceAmountMinor: BigInt(input.amountMinor),
      currency: 'INR',
      ...(input.lenderAmountMinor !== undefined
        ? { lenderAmountMinor: BigInt(input.lenderAmountMinor) }
        : {}),
    });
    const loanRequired = input.fundingType !== 'SELF_FUNDED';
    if (
      loanRequired &&
      (!input.lenderId || !input.branchName || !input.loanAccountNumber || !input.sanctionReference)
    ) {
      throw new BadRequestException(
        'Sanctioned-loan lender, branch, account and sanction reference are required',
      );
    }
    const feeTotal = Object.values(input.feeBreakdown).reduce(
      (sum, value) => sum + BigInt(value),
      0n,
    );
    if (feeTotal <= 0n || feeTotal !== BigInt(input.targetAmountMinor))
      throw new BadRequestException('Fee breakdown must equal the destination amount');
    const personalDetailsCipher = this.cipher.encrypt(
      JSON.stringify({
        studentEmail: input.studentEmail,
        firstName: input.firstName,
        middleName: input.middleName ?? '',
        familyName: input.familyName,
        pinCode: input.pinCode,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? '',
        city: input.city,
        state: input.state ?? '',
        phone: input.phone,
        payerName: input.payerName,
        payerRelationship: input.payerRelationship,
        payerPan: input.payerPan,
      }),
    );
    const record: JourneyCaseRecord = {
      domain,
      universityName,
      destinationCountry: input.destinationCountry,
      targetCurrency: input.targetCurrency,
      targetAmountMinor: input.targetAmountMinor,
      feeBreakdown: input.feeBreakdown,
      providerName: input.providerName,
      providerType: input.providerType,
      semesterLabel,
      personalDetailsCipher,
      collectionReference: `TF-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
      ...(input.lenderId ? { lenderId: input.lenderId } : {}),
      ...(input.lenderName ? { lenderName: input.lenderName } : {}),
      ...(input.branchName ? { branchNameCipher: this.cipher.encrypt(input.branchName) } : {}),
      ...(input.loanAccountNumber
        ? { loanAccountCipher: this.cipher.encrypt(input.loanAccountNumber) }
        : {}),
      ...(input.sanctionReference
        ? { sanctionReferenceCipher: this.cipher.encrypt(input.sanctionReference) }
        : {}),
      documents: [],
      declarationsAccepted: false,
      lenderApproved: false,
      webhookEventIds: [],
      grievances: [],
      privacyRequests: [],
      consents: [],
      audit: [{ event: 'CASE_CREATED', actorId: user.id, at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    this.records.set(id, record);
    await this.persist();
    return this.view(record, user);
  }

  async cleanupDuplicateSemesterPayments(): Promise<{ deleted: string[]; kept: string[] }> {
    const groups = new Map<string, JourneyCaseRecord[]>();
    for (const record of this.records.values()) {
      const key = this.semesterPaymentKey(record);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    const deleted: string[] = [];
    const kept: string[] = [];
    for (const records of groups.values()) {
      if (records.length === 0) continue;
      const sorted = [...records].sort(
        (left: JourneyCaseRecord, right: JourneyCaseRecord) =>
          this.recordUpdatedAt(right) - this.recordUpdatedAt(left),
      );
      const [keeper, ...duplicates] = sorted;
      if (keeper) kept.push(keeper.domain.id);
      for (const duplicate of duplicates) {
        deleted.push(duplicate.domain.id);
        this.records.delete(duplicate.domain.id);
        await this.deletePrivateArtifacts(duplicate);
      }
    }
    if (deleted.length === 0) return { deleted, kept };
    if (this.config.persistence === 'prisma' && this.db) {
      await this.db.journeySnapshot.deleteMany({ where: { id: { in: deleted } } });
    }
    await this.persist();
    return { deleted, kept };
  }

  list(user: AuthUser) {
    return [...this.records.values()]
      .filter((record) => this.canSee(record, user))
      .map((record) => this.view(record, user));
  }

  get(id: string, user: AuthUser) {
    const record = this.mustGet(id);
    if (!this.canSee(record, user))
      throw new ForbiddenException('Case is not assigned to this user');
    return this.view(record, user);
  }

  async addDocument(
    id: string,
    user: AuthUser,
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    const record = this.studentCase(id, user);
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(file.mimetype))
      throw new BadRequestException('Only PDF, JPEG and PNG evidence is accepted');
    const allowedExtensions: Record<string, readonly string[]> = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    };
    if (!allowedExtensions[file.mimetype]?.includes(extname(file.originalname).toLowerCase()))
      throw new BadRequestException('Evidence extension does not match its declared type');
    const validSignature =
      file.mimetype === 'application/pdf'
        ? file.buffer.subarray(0, 4).toString() === '%PDF'
        : file.mimetype === 'image/jpeg'
          ? file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff
          : file.buffer
              .subarray(0, 8)
              .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!validSignature) throw new BadRequestException('Evidence content signature is invalid');
    if (file.buffer.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')))
      throw new BadRequestException('Evidence failed malware screening');
    if (file.buffer.length > 10 * 1024 * 1024)
      throw new BadRequestException('Evidence must not exceed 10 MB');
    const documentId = randomUUID();
    const encryptedPath = `documents/${documentId}.enc`;
    await this.storage.put(encryptedPath, this.cipher.encrypt(file.buffer.toString('base64')));
    record.documents.push({
      id: documentId,
      name: file.originalname.replace(/[^A-Za-z0-9._ -]/g, '_'),
      mimeType: file.mimetype,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      encryptedPath,
      uploadedAt: new Date().toISOString(),
    });
    this.audit(record, 'EVIDENCE_UPLOADED', user.id, file.mimetype);
    await this.persist();
    return this.view(record, user);
  }

  async getDocument(
    id: string,
    documentId: string,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const record = this.mustGet(id);
    if (!this.canSee(record, user)) throw new ForbiddenException();
    if (user.role === 'UNIVERSITY_FINANCE') throw new ForbiddenException();
    const document = record.documents.find((item) => item.id === documentId);
    if (!document) throw new NotFoundException('Evidence not found');
    const encrypted = await this.storage.get(document.encryptedPath);
    return {
      buffer: Buffer.from(this.cipher.decrypt(encrypted), 'base64'),
      mimeType: document.mimeType,
      name: document.name,
    };
  }

  async submit(id: string, user: AuthUser) {
    const record = this.studentCase(id, user);
    if (record.documents.length === 0)
      throw new BadRequestException('At least one evidence document is required');
    record.declarationsAccepted = true;
    record.consents.push({
      noticeVersion: 'privacy-notice-2025-11-v1',
      purposes: ['PAYMENT_ORCHESTRATION', 'REGULATORY_COMPLIANCE', 'CASE_SUPPORT'],
      acceptedAt: new Date().toISOString(),
    });
    record.domain.transition(RemittanceStatus.EVIDENCE_SUBMITTED);
    record.domain.transition(RemittanceStatus.COMPLIANCE_PENDING);
    this.audit(record, 'DECLARATIONS_ACCEPTED', user.id);
    record.compliance = await this.compliance.assess({
      caseId: id,
      studentAge: 21,
      sourceAmountMinor: record.domain.sourceAmountMinor.toString(),
      destinationCountry: record.destinationCountry,
      destinationCurrency: record.targetCurrency,
      hasPan: true,
      declarationsAccepted: true,
    });
    if (record.compliance.outcome === 'APPROVED') {
      record.domain.transition(RemittanceStatus.INSTRUCTION_ISSUED);
      record.domain.transition(RemittanceStatus.FUNDING_PENDING);
      this.audit(
        record,
        'PARTNER_COMPLIANCE_APPROVED',
        'SIMULATED_PA_CB',
        record.compliance.approvalReference,
      );
      await this.createInstruction(record);
    } else if (record.compliance.outcome === 'INFORMATION_REQUIRED')
      record.domain.transition(RemittanceStatus.CHANGES_REQUESTED);
    else record.domain.transition(RemittanceStatus.REJECTED);
    await this.persist();
    return this.view(record, user);
  }

  async lenderDecision(
    id: string,
    user: AuthUser,
    decision: 'APPROVE' | 'REJECT' | 'CHANGES',
    reason?: string,
  ) {
    const record = this.lenderCase(id, user);
    if (record.domain.status !== RemittanceStatus.FUNDING_PENDING)
      throw new ConflictException('Case is not awaiting lender disbursement');
    if (decision === 'APPROVE') record.lenderApproved = true;
    else
      record.domain.transition(
        decision === 'REJECT' ? RemittanceStatus.REJECTED : RemittanceStatus.CHANGES_REQUESTED,
      );
    this.audit(record, `LENDER_${decision}`, user.id, reason);
    await this.persist();
    return this.view(record, user);
  }

  async recordFunding(id: string, user: AuthUser, kind: FundingLegKind, transferReference: string) {
    const record = this.mustGet(id);
    this.assertInstructionActive(record);
    if (kind === 'LENDER') {
      if (user.role !== 'LENDER_OFFICER' || !record.lenderApproved)
        throw new ForbiddenException('Lender approval is required');
      if (record.lenderId !== user.lenderId) throw new ForbiddenException();
    } else if (user.role !== 'PAYMENT_OPS')
      throw new ForbiddenException('Payment operations must verify student funding');
    const leg = record.domain.fundingLegs.find((item) => item.kind === kind);
    if (!leg) throw new BadRequestException('Funding leg is not required');
    record.domain.recordFunding(kind, leg.requiredMinor, transferReference);
    this.audit(record, `${kind}_FUNDING_CONFIRMED`, user.id, this.maskReference(transferReference));
    if (record.domain.isFullyFunded()) record.domain.transition(RemittanceStatus.FUNDS_RECEIVED);
    await this.persist();
    return this.view(record, user);
  }

  async quote(id: string, user: AuthUser) {
    const record = this.opsCase(id, user);
    this.assertInstructionActive(record);
    if (
      record.domain.status !== RemittanceStatus.FUNDS_RECEIVED ||
      !record.compliance ||
      record.compliance.outcome !== 'APPROVED'
    )
      throw new ConflictException('Cleared funds and partner approval are required');
    record.quote = await this.payments.createQuote({
      caseId: id,
      sourceAmountMinor: record.domain.sourceAmountMinor.toString(),
      sourceCurrency: 'INR',
      targetCurrency: record.targetCurrency,
      taxMinor: record.compliance.taxMinor ?? '0',
    });
    this.audit(record, 'FINAL_QUOTE_CREATED', user.id);
    await this.persist();
    return this.view(record, user);
  }

  async initiatePayout(id: string, user: AuthUser, idempotencyKey: string) {
    const record = this.opsCase(id, user);
    if (record.payment) return this.view(record, user);
    const scopedKey = `${user.id}:${id}:payout:${idempotencyKey}`;
    if (record.payoutIdempotencyKey && record.payoutIdempotencyKey !== scopedKey)
      throw new ConflictException('A different payout initiation is already in progress');
    record.payoutIdempotencyKey = scopedKey;
    await this.persist();
    if (!record.quote) throw new ConflictException('Final quote is required');
    if (new Date(record.quote.expiresAt).getTime() <= Date.now())
      throw new ConflictException('Final quote has expired');
    record.payment = await this.payments.createPayment(record.quote, scopedKey);
    if (record.domain.status === RemittanceStatus.FUNDS_RECEIVED)
      record.domain.transition(RemittanceStatus.PAYOUT_SUBMITTED);
    this.audit(record, 'PAYOUT_SUBMITTED', user.id, record.payment.id);
    await this.persist();
    return this.view(record, user);
  }

  async advancePayout(id: string, user: AuthUser) {
    const record = this.opsCase(id, user);
    if (!record.payment) throw new ConflictException('Payout has not been submitted');
    record.payment = await this.payments.advance(record.payment.id);
    const mapping = {
      VALIDATING: RemittanceStatus.VALIDATING,
      TRANSFERRING: RemittanceStatus.TRANSFERRING,
      COMPLETED: RemittanceStatus.COMPLETED,
    } as const;
    const next = mapping[record.payment.status as keyof typeof mapping];
    if (next && record.domain.status !== next) record.domain.transition(next);
    this.audit(record, `PAYOUT_${record.payment.status}`, 'SIMULATED_PAYMENTS_DIRECT_2');
    await this.persist();
    return this.view(record, user);
  }

  async failPayout(id: string, user: AuthUser) {
    const record = this.opsCase(id, user);
    if (!record.payment) throw new ConflictException('Payout has not been submitted');
    record.payment = await this.payments.fail(record.payment.id);
    record.domain.transition(RemittanceStatus.FAILED);
    this.audit(record, 'PAYOUT_FAILED', user.id, 'Synthetic partner failure');
    await this.persist();
    return this.view(record, user);
  }

  async applyPaymentWebhook(
    id: string,
    eventId: string,
    status: 'VALIDATING' | 'TRANSFERRING' | 'COMPLETED' | 'FAILED',
  ) {
    const record = this.mustGet(id);
    if (record.webhookEventIds.includes(eventId))
      return { duplicate: true, status: record.domain.status };
    const expected: Partial<Record<RemittanceStatus, string>> = {
      [RemittanceStatus.PAYOUT_SUBMITTED]: 'VALIDATING',
      [RemittanceStatus.VALIDATING]: 'TRANSFERRING',
      [RemittanceStatus.TRANSFERRING]: 'COMPLETED',
    };
    if (status !== 'FAILED' && expected[record.domain.status] !== status)
      throw new ConflictException(`Out-of-order partner status ${status}`);
    record.domain.transition(
      status === 'FAILED' ? RemittanceStatus.FAILED : RemittanceStatus[status],
    );
    record.webhookEventIds.push(eventId);
    if (record.payment)
      record.payment = { ...record.payment, status, updatedAt: new Date().toISOString() };
    this.audit(record, `PAYMENTS_DIRECT_${status}`, 'PAYMENTS_DIRECT_WEBHOOK', eventId);
    await this.persist();
    return { duplicate: false, status: record.domain.status };
  }

  async createGrievance(id: string, user: AuthUser, category: string, message: string) {
    const record = this.studentCase(id, user);
    record.grievances.push({
      id: randomUUID(),
      category,
      message,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });
    this.audit(record, 'GRIEVANCE_OPENED', user.id, category);
    await this.persist();
    return this.view(record, user);
  }

  async resolveGrievance(id: string, grievanceId: string, user: AuthUser) {
    const record = this.opsCase(id, user);
    const grievance = record.grievances.find((item) => item.id === grievanceId);
    if (!grievance) throw new NotFoundException('Grievance not found');
    grievance.status = 'RESOLVED';
    grievance.resolvedAt = new Date().toISOString();
    this.audit(record, 'GRIEVANCE_RESOLVED', user.id, grievanceId);
    await this.persist();
    return this.view(record, user);
  }

  async createPrivacyRequest(
    id: string,
    user: AuthUser,
    type: PrivacyRequestType,
    details: string,
  ) {
    const record = this.studentCase(id, user);
    if (record.privacyRequests.some((item) => item.type === type && item.status === 'OPEN'))
      throw new ConflictException(`An open ${type.toLowerCase()} request already exists`);
    record.privacyRequests.push({
      id: randomUUID(),
      type,
      details,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });
    if (type === 'CONSENT_WITHDRAWAL') {
      const current = [...record.consents].reverse().find((item) => !item.withdrawnAt);
      if (current) current.withdrawnAt = new Date().toISOString();
    }
    this.audit(record, `PRIVACY_${type}_REQUESTED`, user.id);
    await this.persist();
    return this.view(record, user);
  }

  async exportPersonalData(id: string, user: AuthUser) {
    const record = this.studentCase(id, user);
    if (record.privacyErasedAt)
      throw new ConflictException(
        'Personal data has already been erased under the retention policy',
      );
    this.audit(record, 'PRIVACY_EXPORT_DOWNLOADED', user.id);
    await this.persist();
    return {
      generatedAt: new Date().toISOString(),
      caseId: record.domain.id,
      collectionReference: record.collectionReference,
      personalDetails: JSON.parse(this.cipher.decrypt(record.personalDetailsCipher)) as unknown,
      loan: {
        provider: record.providerName,
        branch: record.branchNameCipher ? this.cipher.decrypt(record.branchNameCipher) : undefined,
        accountNumber: record.loanAccountCipher
          ? this.cipher.decrypt(record.loanAccountCipher)
          : undefined,
        sanctionReference: record.sanctionReferenceCipher
          ? this.cipher.decrypt(record.sanctionReferenceCipher)
          : undefined,
      },
      consents: record.consents,
      privacyRequests: record.privacyRequests,
    };
  }

  async resolvePrivacyRequest(
    id: string,
    requestId: string,
    user: AuthUser,
    decision: 'COMPLETED' | 'DECLINED',
    outcome: string,
  ) {
    const record = this.opsCase(id, user);
    const request = record.privacyRequests.find((item) => item.id === requestId);
    if (!request) throw new NotFoundException('Privacy request not found');
    if (request.status !== 'OPEN')
      throw new ConflictException('Privacy request is already resolved');
    if (request.type === 'ERASURE' && decision === 'COMPLETED' && record.legalHold?.active)
      throw new ConflictException('Erasure is blocked by an active legal hold');
    request.status = decision;
    request.outcome = outcome;
    request.resolvedAt = new Date().toISOString();
    this.audit(record, `PRIVACY_${request.type}_${decision}`, user.id, requestId);
    await this.persist();
    return this.view(record, user);
  }

  async setLegalHold(id: string, user: AuthUser, active: boolean, reason: string) {
    const record = this.opsCase(id, user);
    if (active)
      record.legalHold = { active: true, reason, setAt: new Date().toISOString(), setBy: user.id };
    else {
      if (!record.legalHold?.active) throw new ConflictException('No active legal hold exists');
      record.legalHold = {
        ...record.legalHold,
        active: false,
        releasedAt: new Date().toISOString(),
        releasedBy: user.id,
      };
    }
    this.audit(record, active ? 'LEGAL_HOLD_PLACED' : 'LEGAL_HOLD_RELEASED', user.id, reason);
    await this.persist();
    return this.view(record, user);
  }

  async runRetention(user: AuthUser, cutoffBefore: string) {
    if (user.role !== 'PAYMENT_OPS') throw new ForbiddenException();
    const cutoff = new Date(cutoffBefore);
    if (Number.isNaN(cutoff.getTime()))
      throw new BadRequestException('A valid retention cutoff is required');
    let erased = 0;
    let held = 0;
    for (const record of this.records.values()) {
      const terminal = [
        RemittanceStatus.RECONCILED,
        RemittanceStatus.REJECTED,
        RemittanceStatus.CANCELLED,
      ].includes(record.domain.status);
      if (!terminal || record.privacyErasedAt || new Date(record.createdAt) > cutoff) continue;
      if (record.legalHold?.active) {
        held += 1;
        continue;
      }
      for (const document of record.documents) await this.storage.delete(document.encryptedPath);
      record.documents = [];
      record.personalDetailsCipher = this.cipher.encrypt(JSON.stringify({ erased: true }));
      delete record.branchNameCipher;
      delete record.loanAccountCipher;
      delete record.sanctionReferenceCipher;
      record.privacyErasedAt = new Date().toISOString();
      this.audit(record, 'RETENTION_PERSONAL_DATA_ERASED', user.id);
      erased += 1;
    }
    await this.persist();
    return { cutoffBefore: cutoff.toISOString(), erased, held };
  }

  async reconcile(id: string, user: AuthUser) {
    const record = this.opsCase(id, user);
    if (record.domain.status !== RemittanceStatus.COMPLETED)
      throw new ConflictException('Completed payout is required');
    record.domain.transition(RemittanceStatus.RECONCILED);
    this.audit(record, 'PAYMENT_RECONCILED', user.id);
    await this.createReceipt(record);
    await this.persist();
    return this.view(record, user);
  }

  async instruction(id: string, user: AuthUser): Promise<Buffer> {
    const record = this.mustGet(id);
    if (!this.canSee(record, user)) throw new ForbiddenException();
    if (user.role === 'UNIVERSITY_FINANCE') throw new ForbiddenException();
    if (
      ![
        RemittanceStatus.FUNDING_PENDING,
        RemittanceStatus.FUNDS_RECEIVED,
        RemittanceStatus.PAYOUT_SUBMITTED,
        RemittanceStatus.VALIDATING,
        RemittanceStatus.TRANSFERRING,
        RemittanceStatus.COMPLETED,
        RemittanceStatus.RECONCILED,
      ].includes(record.domain.status)
    )
      throw new ConflictException('Instruction is not available');
    if (!record.instructionPath) await this.createInstruction(record);
    const bytes = await this.readEncryptedPdf(record.instructionPath!);
    this.audit(record, 'INSTRUCTION_DOWNLOADED', user.id);
    await this.persist();
    return bytes;
  }

  async receipt(id: string, user: AuthUser): Promise<Buffer> {
    const record = this.mustGet(id);
    if (!this.canSee(record, user)) throw new ForbiddenException();
    if (user.role === 'UNIVERSITY_FINANCE') throw new ForbiddenException();
    if (record.domain.status !== RemittanceStatus.RECONCILED || !record.receiptPath)
      throw new ConflictException('Final receipt is available after reconciliation');
    this.audit(record, 'RECEIPT_DOWNLOADED', user.id);
    await this.persist();
    return this.readEncryptedPdf(record.receiptPath);
  }

  private mustGet(id: string): JourneyCaseRecord {
    const record = this.records.get(id);
    if (!record) throw new NotFoundException('Case not found');
    return record;
  }
  private studentCase(id: string, user: AuthUser) {
    const record = this.mustGet(id);
    if (user.role !== 'STUDENT' || record.domain.studentId !== user.id)
      throw new ForbiddenException();
    return record;
  }
  private lenderCase(id: string, user: AuthUser) {
    const record = this.mustGet(id);
    if (user.role !== 'LENDER_OFFICER' || record.lenderId !== user.lenderId)
      throw new ForbiddenException();
    return record;
  }
  private opsCase(id: string, user: AuthUser) {
    if (user.role !== 'PAYMENT_OPS') throw new ForbiddenException();
    return this.mustGet(id);
  }
  private canSee(record: JourneyCaseRecord, user: AuthUser): boolean {
    return (
      user.role === 'PAYMENT_OPS' ||
      (user.role === 'STUDENT' &&
        record.domain.studentId === user.id &&
        (!user.universityName || record.universityName === user.universityName)) ||
      (user.role === 'LENDER_OFFICER' && record.lenderId === user.lenderId) ||
      (user.role === 'UNIVERSITY_FINANCE' && record.universityName === user.universityName)
    );
  }
  private audit(record: JourneyCaseRecord, event: string, actorId: string, detail?: string): void {
    record.audit.push({
      event,
      actorId,
      at: new Date().toISOString(),
      ...(detail ? { detail } : {}),
    });
  }
  private maskReference(value: string): string {
    return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
  }
  private semesterPaymentKey(record: JourneyCaseRecord): string {
    return [record.domain.studentId, record.universityName, record.semesterLabel].join('|');
  }
  private recordUpdatedAt(record: JourneyCaseRecord): number {
    return new Date(
      record.audit.at(-1)?.at ?? record.payment?.updatedAt ?? record.createdAt,
    ).getTime();
  }
  private async deletePrivateArtifacts(record: JourneyCaseRecord): Promise<void> {
    await Promise.all([
      ...record.documents.map((document) => this.storage.delete(document.encryptedPath)),
      ...(record.instructionPath ? [this.storage.delete(record.instructionPath)] : []),
      ...(record.receiptPath ? [this.storage.delete(record.receiptPath)] : []),
    ]);
  }
  private assertInstructionActive(record: JourneyCaseRecord): void {
    if (
      record.instructionCreatedAt &&
      Date.now() > new Date(record.instructionCreatedAt).getTime() + 72 * 60 * 60_000
    ) {
      if (record.domain.status === RemittanceStatus.FUNDING_PENDING)
        record.domain.transition(RemittanceStatus.EXPIRED);
      throw new ConflictException('Payment instruction has expired');
    }
  }
  private normalizeRecord(record: JourneyCaseRecord): JourneyCaseRecord {
    const fallbackProfile = {
      studentEmail: 'student@tuitionflow.local',
      firstName: 'Synthetic',
      familyName: 'Student',
      payerName: 'Synthetic Payer',
      payerPan: 'ABCDE1234F',
    };
    return {
      ...record,
      targetAmountMinor: record.targetAmountMinor ?? '1000000',
      feeBreakdown: record.feeBreakdown ?? {
        tuitionAdvanceMinor: record.targetAmountMinor ?? '1000000',
        courseDepositMinor: '0',
        accommodationMinor: '0',
        otherMinor: '0',
      },
      providerName: record.providerName ?? record.lenderName ?? 'State Bank of India',
      providerType: record.providerType ?? 'BANK',
      semesterLabel: record.semesterLabel ?? 'Semester 1',
      personalDetailsCipher:
        record.personalDetailsCipher ?? this.cipher.encrypt(JSON.stringify(fallbackProfile)),
      collectionReference:
        record.collectionReference ??
        `TF-${new Date().getUTCFullYear()}-${record.domain.id.slice(0, 8).toUpperCase()}`,
      webhookEventIds: record.webhookEventIds ?? [],
      grievances: record.grievances ?? [],
      privacyRequests: record.privacyRequests ?? [],
      consents: record.consents ?? [],
    };
  }
  private async createInstruction(record: JourneyCaseRecord): Promise<void> {
    if (record.instructionPath) return;
    const person = JSON.parse(this.cipher.decrypt(record.personalDetailsCipher)) as {
      firstName: string;
      familyName: string;
      payerName: string;
      payerPan: string;
    };
    const loanAccount = record.loanAccountCipher
      ? this.cipher.decrypt(record.loanAccountCipher)
      : 'N/A';
    const branch = record.branchNameCipher ? this.cipher.decrypt(record.branchNameCipher) : 'N/A';
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawRectangle({ x: 0, y: 740, width: 595, height: 102, color: rgb(0.03, 0.16, 0.28) });
    page.drawText('TuitionFlow', { x: 48, y: 795, size: 24, font: bold, color: rgb(1, 1, 1) });
    page.drawText('PAYMENT INITIATION REQUEST', {
      x: 48,
      y: 765,
      size: 11,
      font: bold,
      color: rgb(0.35, 0.85, 0.76),
    });
    page.drawText('SIMULATION - NOT PROOF OF PAYMENT', {
      x: 335,
      y: 795,
      size: 9,
      font: bold,
      color: rgb(1, 0.75, 0.75),
    });
    const lines = [
      ['Collection reference', record.collectionReference],
      ['Case reference', record.domain.id],
      ['University', record.universityName],
      ['Student', `${person.firstName} ${person.familyName}`],
      ['Payer', `${person.payerName} (PAN ending ${person.payerPan.slice(-4)})`],
      ['Loan provider', record.providerName],
      ['Loan branch / centre', branch],
      ['Loan account', loanAccount],
      [
        'University receives',
        `${this.formatMinor(record.targetAmountMinor)} ${record.targetCurrency}`,
      ],
      ['Amount to remit', `${this.formatMinor(record.domain.sourceAmountMinor.toString())} INR`],
      ['Regulatory route', record.compliance?.route ?? 'Pending'],
      ['Partner approval', record.compliance?.approvalReference ?? 'Pending'],
      ['Valid until', new Date(Date.now() + 72 * 60 * 60_000).toISOString()],
    ] as const;
    lines.forEach(([label, value], index) => {
      const y = 700 - index * 32;
      page.drawText(label, { x: 48, y, size: 9, font: regular, color: rgb(0.4, 0.45, 0.5) });
      page.drawText(value, { x: 210, y, size: 10, font: bold, color: rgb(0.07, 0.15, 0.24) });
    });
    page.drawText(
      'Send funds only to the collection account supplied by the authorised Indian PA-CB/AD bank.',
      { x: 48, y: 245, size: 9, font: bold },
    );
    page.drawText(
      'TuitionFlow does not receive or hold customer money. Quote and tax remain partner-authoritative.',
      { x: 48, y: 225, size: 8, font: regular },
    );
    const bytes = Buffer.from(await pdf.save());
    record.instructionPath = await this.writeEncryptedPdf(`instruction-${record.domain.id}`, bytes);
    record.instructionHash = createHash('sha256').update(bytes).digest('hex');
    record.instructionCreatedAt = new Date().toISOString();
    this.audit(record, 'INSTRUCTION_GENERATED', 'SYSTEM', record.collectionReference);
  }
  private async createReceipt(record: JourneyCaseRecord): Promise<void> {
    if (record.receiptPath) return;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText('TuitionFlow Payment Receipt', {
      x: 48,
      y: 780,
      size: 22,
      font: bold,
      color: rgb(0.03, 0.35, 0.25),
    });
    const lines = [
      `Status: RECONCILED`,
      `Collection reference: ${record.collectionReference}`,
      `University: ${record.universityName}`,
      `University received: ${this.formatMinor(record.quote?.targetAmountMinor ?? record.targetAmountMinor)} ${record.targetCurrency}`,
      `Payment ID: ${record.payment?.id ?? 'N/A'}`,
      `Completed: ${record.payment?.updatedAt ?? new Date().toISOString()}`,
    ];
    lines.forEach((line, index) =>
      page.drawText(line, {
        x: 48,
        y: 730 - index * 34,
        size: 11,
        font: index === 0 ? bold : regular,
      }),
    );
    const bytes = Buffer.from(await pdf.save());
    record.receiptPath = await this.writeEncryptedPdf(`receipt-${record.domain.id}`, bytes);
    record.receiptHash = createHash('sha256').update(bytes).digest('hex');
  }
  private async writeEncryptedPdf(name: string, bytes: Buffer): Promise<string> {
    const key = `pdf/${name}.enc`;
    await this.storage.put(key, this.cipher.encrypt(bytes.toString('base64')));
    return key;
  }
  private async readEncryptedPdf(path: string): Promise<Buffer> {
    return Buffer.from(this.cipher.decrypt(await this.storage.get(path)), 'base64');
  }
  private formatMinor(value: string): string {
    const amount = BigInt(value);
    return `${amount / 100n}.${(amount % 100n).toString().padStart(2, '0')}`;
  }
  private async persist(): Promise<void> {
    const rows: StoredJourneySnapshot[] = [...this.records.values()].map(
      ({ domain, ...record }) => ({
        domain: {
          id: domain.id,
          studentId: domain.studentId,
          fundingType: domain.fundingType,
          sourceAmountMinor: domain.sourceAmountMinor.toString(),
          status: domain.status,
          lenderAmountMinor:
            domain.fundingLegs.find((leg) => leg.kind === 'LENDER')?.requiredMinor.toString() ??
            '0',
          fundingLegs: domain.fundingLegs.map((leg) => ({
            ...leg,
            requiredMinor: leg.requiredMinor.toString(),
            receivedMinor: leg.receivedMinor.toString(),
          })),
        },
        record,
      }),
    );
    if (this.config.persistence === 'prisma' && this.db) {
      await this.db.$transaction(
        rows.map((row) =>
          this.db!.journeySnapshot.upsert({
            where: { id: row.domain.id },
            create: { id: row.domain.id, recordJson: JSON.stringify(row) },
            update: { recordJson: JSON.stringify(row) },
          }),
        ),
      );
      return;
    }
    await mkdir(join(process.cwd(), '.data'), { recursive: true });
    const temporary = `${this.snapshotPath}.tmp`;
    await writeFile(temporary, JSON.stringify(rows), 'utf8');
    await rename(temporary, this.snapshotPath);
  }
  private view(record: JourneyCaseRecord, user: AuthUser) {
    const personalDetails = this.personalDetails(record);
    const lastUpdatedAt = record.audit.at(-1)?.at ?? record.payment?.updatedAt ?? record.createdAt;
    const universityFinanceView = user.role === 'UNIVERSITY_FINANCE';
    return {
      id: record.domain.id,
      studentId: record.domain.studentId,
      status: record.domain.status,
      fundingType: record.domain.fundingType,
      sourceAmountMinor: record.domain.sourceAmountMinor.toString(),
      sourceCurrency: record.domain.currency,
      universityName: record.universityName,
      destinationCountry: record.destinationCountry,
      targetCurrency: record.targetCurrency,
      targetAmountMinor: record.targetAmountMinor,
      feeBreakdown: record.feeBreakdown,
      providerName: record.providerName,
      providerType: record.providerType,
      semesterLabel: record.semesterLabel,
      collectionReference: record.collectionReference,
      ...(universityFinanceView
        ? {
            student: {
              name: [
                personalDetails.firstName,
                personalDetails.middleName,
                personalDetails.familyName,
              ]
                .filter(Boolean)
                .join(' '),
              email: personalDetails.studentEmail,
            },
          }
        : {}),
      lenderName: record.lenderName,
      lenderApproved: record.lenderApproved,
      fundingLegs: record.domain.fundingLegs.map((leg) => ({
        kind: leg.kind,
        requiredMinor: leg.requiredMinor.toString(),
        receivedMinor: leg.receivedMinor.toString(),
        funded: leg.requiredMinor === leg.receivedMinor,
      })),
      documents: universityFinanceView
        ? []
        : record.documents.map(({ encryptedPath: _encryptedPath, ...document }) => document),
      compliance: universityFinanceView ? undefined : record.compliance,
      quote: record.quote,
      payment: record.payment,
      instructionHash: record.instructionHash,
      instructionCreatedAt: record.instructionCreatedAt,
      receiptHash: record.receiptHash,
      grievances: universityFinanceView ? [] : record.grievances,
      privacyRequests: universityFinanceView ? [] : record.privacyRequests,
      consents: universityFinanceView ? [] : record.consents,
      legalHold: universityFinanceView ? undefined : record.legalHold,
      privacyErasedAt: universityFinanceView ? undefined : record.privacyErasedAt,
      audit: universityFinanceView
        ? []
        : record.audit.map((entry) =>
            user.role === 'STUDENT' ? { event: entry.event, at: entry.at } : entry,
          ),
      createdAt: record.createdAt,
      lastUpdatedAt,
    };
  }

  private personalDetails(record: JourneyCaseRecord): {
    studentEmail: string;
    firstName: string;
    middleName?: string;
    familyName: string;
  } {
    let value: {
      studentEmail?: string;
      firstName?: string;
      middleName?: string;
      familyName?: string;
    };
    try {
      value = JSON.parse(this.cipher.decrypt(record.personalDetailsCipher)) as typeof value;
    } catch {
      value = {
        studentEmail: 'student@tuitionflow.local',
        firstName: 'Synthetic',
        familyName: 'Student',
      };
    }
    return {
      studentEmail: value.studentEmail ?? '',
      firstName: value.firstName ?? '',
      ...(value.middleName ? { middleName: value.middleName } : {}),
      familyName: value.familyName ?? '',
    };
  }
}

interface StoredJourneySnapshot {
  domain: {
    id: string;
    studentId: string;
    fundingType: JourneyCaseRecord['domain']['fundingType'];
    sourceAmountMinor: string;
    lenderAmountMinor: string;
    status: RemittanceStatus;
    fundingLegs: Array<{
      kind: FundingLegKind;
      requiredMinor: string;
      receivedMinor: string;
      transferReference?: string;
    }>;
  };
  record: Omit<JourneyCaseRecord, 'domain'>;
}
