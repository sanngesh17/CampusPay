import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseId,
  CaseStatus,
  type Currency,
  type DomainEvent,
  LenderId,
  Money,
  type PaymentMode,
  ReferenceCode,
  StudentId,
  TuitionCase,
  UniversityId,
} from '@tuitionflow/domain';
import type {
  FundingType,
  InitiationRequest,
  QuoteRequest,
  RailAdapter,
  RailRouter,
} from '@tuitionflow/rails';
import { AttestationService } from '../events/attestation.service';
import type {
  AuditRepository,
  BeneficiaryRepository,
  CaseRepository,
  IdempotencyRepository,
  LenderRepository,
  StudentRepository,
} from '../persistence/ports';
import type { StoredCase } from '../persistence/records';
import {
  AUDIT_REPOSITORY,
  BENEFICIARY_REPOSITORY,
  CASE_REPOSITORY,
  IDEMPOTENCY_REPOSITORY,
  LENDER_REPOSITORY,
  RAIL_ROUTER,
  STUDENT_REPOSITORY,
} from '../tokens';
import { rebuildQuote, rehydrateCase } from './case.mapper';
import type { CaseDetailView, CaseSummary, CaseView, ReceiptView } from './case.views';

/** Domain events whose milestone must be anchored on-chain (hash only). */
const EVENT_MILESTONE: Partial<Record<DomainEvent['type'], CaseStatus>> = {
  CaseValidated: CaseStatus.VALIDATED,
  QuoteLocked: CaseStatus.QUOTE_LOCKED,
  PaymentSettled: CaseStatus.PAID,
  CaseReconciled: CaseStatus.RECONCILED,
};

export interface CreateCaseInput {
  studentId: string;
  lenderId: string;
  beneficiaryId: string;
  amountMinor: string;
  currency: Currency;
  mode: PaymentMode;
  funding: FundingType;
  reference?: string;
}

export interface InitiateResult {
  paymentRef: { railId: string; paymentId: string };
  status: string;
  idempotent: boolean;
}

@Injectable()
export class CaseService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly cases: CaseRepository,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(LENDER_REPOSITORY) private readonly lenders: LenderRepository,
    @Inject(BENEFICIARY_REPOSITORY) private readonly beneficiaries: BeneficiaryRepository,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(IDEMPOTENCY_REPOSITORY) private readonly idempotency: IdempotencyRepository,
    @Inject(RAIL_ROUTER) private readonly rails: RailRouter,
    private readonly attestations: AttestationService,
  ) {}

  async createCase(input: CreateCaseInput): Promise<CaseView> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundException(`Unknown student: ${input.studentId}`);
    const lender = await this.lenders.findById(input.lenderId);
    if (!lender) throw new NotFoundException(`Unknown lender: ${input.lenderId}`);
    const beneficiary = await this.beneficiaries.findById(input.beneficiaryId);
    if (!beneficiary) throw new NotFoundException(`Unknown beneficiary: ${input.beneficiaryId}`);

    if (input.reference !== undefined) {
      // Validate the payment reference against the institution rule (throws on mismatch).
      ReferenceCode.create(input.reference, new RegExp(beneficiary.referenceRule));
    }

    const domain = TuitionCase.create({
      id: CaseId.generate(),
      mode: input.mode,
      student: { id: StudentId.create(student.id), displayName: student.fullName },
      lender: { id: LenderId.create(lender.id), name: lender.name },
      beneficiary: { id: UniversityId.create(beneficiary.id), name: beneficiary.name },
      amount: Money.of(BigInt(input.amountMinor), input.currency),
    });

    const rec: StoredCase = {
      id: domain.id,
      status: domain.status,
      mode: input.mode,
      funding: input.funding,
      amountMinor: input.amountMinor,
      currency: input.currency,
      student: { id: student.id, displayName: student.fullName },
      lender: { id: lender.id, name: lender.name },
      beneficiary: {
        id: beneficiary.id,
        name: beneficiary.name,
        currency: beneficiary.currency,
        referenceRule: beneficiary.referenceRule,
        beneficiaryRef: beneficiary.beneficiaryRef,
      },
      reference: input.reference,
      createdAt: new Date().toISOString(),
    };
    await this.cases.create(rec);
    await this.dispatch(rec.id, domain.pullEvents());
    return this.view(rec);
  }

  async collectDocuments(caseId: string, documents: string[]): Promise<CaseView> {
    const rec = await this.mustFind(caseId);
    const domain = rehydrateCase(rec);
    domain.collectDocs();
    await this.persist(rec, domain);
    await this.audit.add({
      id: randomUUID(),
      caseId,
      event: 'DocumentsAttached',
      detail: `${documents.length} document reference(s)`,
      createdAt: new Date().toISOString(),
    });
    return this.view(rec);
  }

  async validate(caseId: string): Promise<CaseView> {
    const rec = await this.mustFind(caseId);
    const domain = rehydrateCase(rec);
    domain.validate();
    await this.persist(rec, domain);
    return this.view(rec);
  }

  async quote(caseId: string): Promise<CaseView> {
    const rec = await this.mustFind(caseId);
    const request: QuoteRequest = {
      amount: Money.of(BigInt(rec.amountMinor), rec.currency),
      sourceCurrency: rec.currency,
      targetCurrency: rec.beneficiary.currency,
      mode: rec.mode,
      funding: rec.funding,
    };
    const adapter = this.rails.select(request);
    const quote = await adapter.getQuote(request);

    const domain = rehydrateCase(rec);
    domain.submitToPartner();
    domain.recordKycVerified(); // MockRailAdapter simulates a KYC pass
    domain.lockQuote(quote, adapter.id);

    rec.rail = adapter.id;
    rec.quote = {
      id: quote.id,
      fxRate: quote.fxRate,
      principalMinor: quote.principal.minor.toString(),
      feesMinor: quote.fees.minor.toString(),
      tcsMinor: quote.tcs.minor.toString(),
      finalPayableMinor: quote.finalPayable.minor.toString(),
      currency: quote.principal.currency,
      expiresAt: quote.expiresAt.toISOString(),
    };
    await this.persist(rec, domain);
    return this.view(rec);
  }

  async initiate(caseId: string, idempotencyKey: string | undefined): Promise<InitiateResult> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const cached = await this.idempotency.get(idempotencyKey);
    if (cached) {
      return { ...(JSON.parse(cached) as InitiateResult), idempotent: true };
    }

    const rec = await this.mustFind(caseId);
    if (!rec.quote || !rec.rail) {
      throw new ConflictException('Case has no locked quote to initiate');
    }
    const adapter = this.adapterFor(rec.rail);
    const domain = rehydrateCase(rec);
    domain.markFunded();

    const initiation: InitiationRequest = {
      quote: rebuildQuote(rec.quote),
      caseId,
      beneficiaryRef: rec.beneficiary.beneficiaryRef,
      reference: rec.reference ?? rec.beneficiary.beneficiaryRef,
      idempotencyKey,
    };
    const paymentRef = await adapter.initiatePayment(initiation);
    domain.enterSettlement();

    rec.payment = { railId: paymentRef.railId, paymentId: paymentRef.paymentId, status: 'PENDING' };
    await this.persist(rec, domain);

    const result: InitiateResult = {
      paymentRef: { railId: paymentRef.railId, paymentId: paymentRef.paymentId },
      status: rec.status,
      idempotent: false,
    };
    await this.idempotency.save(idempotencyKey, 'initiate', JSON.stringify(result));
    return result;
  }

  /** Partner webhook: confirm settlement, store the receipt, and reconcile. */
  async settle(caseId: string, paymentId: string, status: string): Promise<{ status: string }> {
    const rec = await this.mustFind(caseId);
    if (!rec.payment || rec.payment.paymentId !== paymentId) {
      throw new BadRequestException('Unknown payment for case');
    }
    if (status !== 'SETTLED' && status !== 'PAID') {
      rec.payment.status = status;
      await this.cases.save(rec);
      return { status: rec.status };
    }

    const adapter = this.adapterFor(rec.rail);
    const ref = { railId: rec.payment.railId, paymentId: rec.payment.paymentId };
    // Drive the mock rail to PAID (a stand-in for the partner's settlement timeline).
    let railStatus = (await adapter.getStatus(ref)).status;
    for (let i = 0; i < 5 && railStatus !== 'PAID'; i += 1) {
      railStatus = (await adapter.getStatus(ref)).status;
    }
    const receipt = await adapter.getReceipt(ref);

    const domain = rehydrateCase(rec);
    domain.markPaid(receipt.ref.paymentId);
    rec.payment.status = 'PAID';
    rec.payment.receiptHash = receipt.proofHash;
    await this.persist(rec, domain); // attest PAID

    domain.reconcile();
    await this.persist(rec, domain); // attest RECONCILED
    return { status: rec.status };
  }

  /** Demo convenience: simulate the partner settling this case (no HMAC) so the UI can reach PAID. */
  async demoSettle(caseId: string): Promise<{ status: string }> {
    const rec = await this.mustFind(caseId);
    if (!rec.payment) throw new ConflictException('Case has no payment to settle');
    return this.settle(caseId, rec.payment.paymentId, 'SETTLED');
  }

  async listCases(): Promise<CaseSummary[]> {
    const recs = await this.cases.list();
    const summaries: CaseSummary[] = [];
    for (const rec of recs) {
      const atts = await this.attestations.list(rec.id);
      summaries.push({
        id: rec.id,
        status: rec.status,
        mode: rec.mode,
        beneficiary: rec.beneficiary.name,
        amount: { minor: rec.amountMinor, currency: rec.currency },
        attestationCount: atts.length,
      });
    }
    return summaries;
  }

  async getCase(caseId: string): Promise<CaseDetailView> {
    const rec = await this.mustFind(caseId);
    const entries = await this.audit.listByCase(caseId);
    const timeline = entries.map((e) => ({ event: e.event, at: e.createdAt, detail: e.detail }));
    return { ...this.view(rec), timeline };
  }

  async getReceipt(caseId: string): Promise<ReceiptView> {
    const rec = await this.mustFind(caseId);
    if (!rec.payment || !rec.payment.receiptHash) {
      throw new ConflictException('Receipt is not available until the case is paid');
    }
    const amount = rec.quote
      ? { minor: rec.quote.finalPayableMinor, currency: rec.quote.currency }
      : { minor: rec.amountMinor, currency: rec.currency };
    return {
      caseId,
      paymentId: rec.payment.paymentId,
      rail: rec.payment.railId,
      status: rec.payment.status,
      proofHash: rec.payment.receiptHash,
      amountPaid: amount,
    };
  }

  // ----- internals -----

  private async mustFind(caseId: string): Promise<StoredCase> {
    const rec = await this.cases.findById(caseId);
    if (!rec) throw new NotFoundException(`Unknown case: ${caseId}`);
    return rec;
  }

  private adapterFor(railId: string | undefined): RailAdapter {
    const adapter = this.rails.list().find((a) => a.id === railId);
    if (!adapter) throw new ConflictException(`No adapter for rail ${railId ?? '(none)'}`);
    return adapter;
  }

  private async persist(rec: StoredCase, domain: TuitionCase): Promise<void> {
    rec.status = domain.status;
    if (domain.rail) rec.rail = domain.rail;
    if (domain.failureReason) rec.failureReason = domain.failureReason;
    await this.cases.save(rec);
    await this.dispatch(rec.id, domain.pullEvents());
  }

  private async dispatch(caseId: string, events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.audit.add({
        id: randomUUID(),
        caseId,
        event: event.type,
        detail: 'rail' in event ? event.rail : undefined,
        createdAt: event.occurredAt.toISOString(),
      });
      const milestone = EVENT_MILESTONE[event.type];
      if (milestone) {
        await this.attestations.recordMilestone(caseId, milestone, { event: event.type });
      }
    }
  }

  private view(rec: StoredCase): CaseView {
    return {
      id: rec.id,
      status: rec.status,
      mode: rec.mode,
      funding: rec.funding,
      amount: { minor: rec.amountMinor, currency: rec.currency },
      rail: rec.rail,
      beneficiary: { id: rec.beneficiary.id, name: rec.beneficiary.name },
      quote: rec.quote
        ? {
            id: rec.quote.id,
            fxRate: rec.quote.fxRate,
            principalMinor: rec.quote.principalMinor,
            feesMinor: rec.quote.feesMinor,
            tcsMinor: rec.quote.tcsMinor,
            finalPayableMinor: rec.quote.finalPayableMinor,
            currency: rec.quote.currency,
            expiresAt: rec.quote.expiresAt,
          }
        : undefined,
    };
  }
}
