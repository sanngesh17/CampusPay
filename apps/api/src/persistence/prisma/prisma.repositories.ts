import type { PrismaClient } from '@prisma/client';
import type { CaseStatus, Currency, PaymentMode } from '@tuitionflow/domain';
import type { FundingType, RailType } from '@tuitionflow/rails';
import type {
  AttestationRepository,
  AuditRepository,
  BeneficiaryRepository,
  CaseRepository,
  IdempotencyRepository,
  LenderRepository,
  StudentRepository,
} from '../ports';
import type {
  AttestationRecord,
  AuditEntry,
  StoredCase,
  StoredLender,
  StoredStudent,
  StoredUniversity,
} from '../records';

export class PrismaCaseRepository implements CaseRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(r: StoredCase): Promise<void> {
    await this.db.case.create({
      data: {
        id: r.id,
        status: r.status,
        mode: r.mode,
        funding: r.funding,
        amountMinor: BigInt(r.amountMinor),
        currency: r.currency,
        rail: r.rail ?? null,
        failureReason: r.failureReason ?? null,
        studentId: r.student.id,
        lenderId: r.lender.id,
        universityId: r.beneficiary.id,
      },
    });
  }

  async findById(id: string): Promise<StoredCase | null> {
    const c = await this.db.case.findUnique({
      where: { id },
      include: { student: true, lender: true, university: true, quote: true, payment: true },
    });
    if (!c) return null;
    return {
      id: c.id,
      status: c.status as CaseStatus,
      mode: c.mode as PaymentMode,
      funding: c.funding as FundingType,
      amountMinor: c.amountMinor.toString(),
      currency: c.currency as Currency,
      student: { id: c.student.id, displayName: c.student.fullName },
      lender: { id: c.lender.id, name: c.lender.name },
      beneficiary: {
        id: c.university.id,
        name: c.university.name,
        currency: c.university.currency as Currency,
        referenceRule: c.university.referenceRule,
        beneficiaryRef: c.university.beneficiaryRef,
      },
      rail: (c.rail ?? undefined) as RailType | undefined,
      quote: c.quote
        ? {
            id: c.quote.id,
            fxRate: c.quote.fxRate,
            principalMinor: c.quote.principalMinor.toString(),
            feesMinor: c.quote.feesMinor.toString(),
            tcsMinor: c.quote.tcsMinor.toString(),
            finalPayableMinor: c.quote.finalPayableMinor.toString(),
            currency: c.quote.currency as Currency,
            expiresAt: c.quote.expiresAt.toISOString(),
          }
        : undefined,
      payment: c.payment
        ? {
            railId: c.payment.railId as RailType,
            paymentId: c.payment.paymentId,
            status: c.payment.status,
            receiptHash: c.payment.receiptHash ?? undefined,
          }
        : undefined,
      failureReason: c.failureReason ?? undefined,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async save(r: StoredCase): Promise<void> {
    await this.db.case.update({
      where: { id: r.id },
      data: { status: r.status, rail: r.rail ?? null, failureReason: r.failureReason ?? null },
    });
    if (r.quote) {
      const q = r.quote;
      await this.db.quote.upsert({
        where: { caseId: r.id },
        create: {
          id: q.id,
          caseId: r.id,
          fxRate: q.fxRate,
          principalMinor: BigInt(q.principalMinor),
          feesMinor: BigInt(q.feesMinor),
          tcsMinor: BigInt(q.tcsMinor),
          finalPayableMinor: BigInt(q.finalPayableMinor),
          currency: q.currency,
          expiresAt: new Date(q.expiresAt),
        },
        update: {
          fxRate: q.fxRate,
          finalPayableMinor: BigInt(q.finalPayableMinor),
          expiresAt: new Date(q.expiresAt),
        },
      });
    }
    if (r.payment) {
      const p = r.payment;
      await this.db.payment.upsert({
        where: { caseId: r.id },
        create: {
          caseId: r.id,
          railId: p.railId,
          paymentId: p.paymentId,
          status: p.status,
          receiptHash: p.receiptHash ?? null,
        },
        update: { status: p.status, receiptHash: p.receiptHash ?? null },
      });
    }
  }

  async list(): Promise<StoredCase[]> {
    const rows = await this.db.case.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const out: StoredCase[] = [];
    for (const row of rows) {
      const c = await this.findById(row.id);
      if (c) out.push(c);
    }
    return out;
  }
}

export class PrismaStudentRepository implements StudentRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsert(r: StoredStudent): Promise<void> {
    const data = {
      fullName: r.fullName,
      email: r.email,
      countryOfStudy: r.countryOfStudy,
      panCipher: r.panCipher ?? null,
      passportCipher: r.passportCipher ?? null,
      bankAccountCipher: r.bankAccountCipher ?? null,
      keyRef: r.keyRef ?? null,
    };
    await this.db.student.upsert({
      where: { id: r.id },
      create: { id: r.id, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<StoredStudent | null> {
    const s = await this.db.student.findUnique({ where: { id } });
    if (!s) return null;
    return {
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      countryOfStudy: s.countryOfStudy,
      panCipher: s.panCipher ?? undefined,
      passportCipher: s.passportCipher ?? undefined,
      bankAccountCipher: s.bankAccountCipher ?? undefined,
      keyRef: s.keyRef ?? undefined,
    };
  }
}

export class PrismaLenderRepository implements LenderRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsert(r: StoredLender): Promise<void> {
    await this.db.lender.upsert({
      where: { id: r.id },
      create: { id: r.id, name: r.name, type: r.type },
      update: { name: r.name, type: r.type },
    });
  }

  async findById(id: string): Promise<StoredLender | null> {
    const l = await this.db.lender.findUnique({ where: { id } });
    return l ? { id: l.id, name: l.name, type: l.type } : null;
  }
}

export class PrismaBeneficiaryRepository implements BeneficiaryRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsert(r: StoredUniversity): Promise<void> {
    const data = {
      name: r.name,
      country: r.country,
      currency: r.currency,
      referenceRule: r.referenceRule,
      beneficiaryRef: r.beneficiaryRef,
    };
    await this.db.university.upsert({
      where: { id: r.id },
      create: { id: r.id, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<StoredUniversity | null> {
    const u = await this.db.university.findUnique({ where: { id } });
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      country: u.country,
      currency: u.currency as Currency,
      referenceRule: u.referenceRule,
      beneficiaryRef: u.beneficiaryRef,
    };
  }

  async list(): Promise<StoredUniversity[]> {
    const rows = await this.db.university.findMany();
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      country: u.country,
      currency: u.currency as Currency,
      referenceRule: u.referenceRule,
      beneficiaryRef: u.beneficiaryRef,
    }));
  }
}

export class PrismaAttestationRepository implements AttestationRepository {
  constructor(private readonly db: PrismaClient) {}

  async add(r: AttestationRecord): Promise<void> {
    await this.db.attestation.create({
      data: {
        id: r.id,
        caseId: r.caseId,
        milestone: r.milestone,
        sha256: r.sha256,
        txHash: r.txHash ?? null,
      },
    });
  }

  async listByCase(caseId: string): Promise<AttestationRecord[]> {
    const rows = await this.db.attestation.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((a) => ({
      id: a.id,
      caseId: a.caseId,
      milestone: a.milestone,
      sha256: a.sha256,
      txHash: a.txHash ?? undefined,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async add(e: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: { id: e.id, caseId: e.caseId ?? null, event: e.event, detail: e.detail ?? null },
    });
  }

  async listByCase(caseId: string): Promise<AuditEntry[]> {
    const rows = await this.db.auditLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((e) => ({
      id: e.id,
      caseId: e.caseId ?? undefined,
      event: e.event,
      detail: e.detail ?? undefined,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

export class PrismaIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: PrismaClient) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.idempotencyKey.findUnique({ where: { key } });
    return row?.responseJson ?? null;
  }

  async save(key: string, endpoint: string, responseJson: string): Promise<void> {
    await this.db.idempotencyKey.upsert({
      where: { key },
      create: { key, endpoint, responseJson },
      update: {},
    });
  }
}
