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

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryCaseRepository implements CaseRepository {
  private readonly store = new Map<string, StoredCase>();

  async create(record: StoredCase): Promise<void> {
    this.store.set(record.id, clone(record));
  }

  async findById(id: string): Promise<StoredCase | null> {
    const record = this.store.get(id);
    return record ? clone(record) : null;
  }

  async save(record: StoredCase): Promise<void> {
    this.store.set(record.id, clone(record));
  }

  async list(): Promise<StoredCase[]> {
    return [...this.store.values()].map(clone);
  }
}

export class InMemoryStudentRepository implements StudentRepository {
  private readonly store = new Map<string, StoredStudent>();

  async upsert(record: StoredStudent): Promise<void> {
    this.store.set(record.id, clone(record));
  }

  async findById(id: string): Promise<StoredStudent | null> {
    const record = this.store.get(id);
    return record ? clone(record) : null;
  }
}

export class InMemoryLenderRepository implements LenderRepository {
  private readonly store = new Map<string, StoredLender>();

  async upsert(record: StoredLender): Promise<void> {
    this.store.set(record.id, clone(record));
  }

  async findById(id: string): Promise<StoredLender | null> {
    const record = this.store.get(id);
    return record ? clone(record) : null;
  }
}

export class InMemoryBeneficiaryRepository implements BeneficiaryRepository {
  private readonly store = new Map<string, StoredUniversity>();

  async upsert(record: StoredUniversity): Promise<void> {
    this.store.set(record.id, clone(record));
  }

  async findById(id: string): Promise<StoredUniversity | null> {
    const record = this.store.get(id);
    return record ? clone(record) : null;
  }

  async list(): Promise<StoredUniversity[]> {
    return [...this.store.values()].map(clone);
  }
}

export class InMemoryAttestationRepository implements AttestationRepository {
  private readonly store: AttestationRecord[] = [];

  async add(record: AttestationRecord): Promise<void> {
    this.store.push(clone(record));
  }

  async listByCase(caseId: string): Promise<AttestationRecord[]> {
    return this.store.filter((a) => a.caseId === caseId).map(clone);
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly store: AuditEntry[] = [];

  async add(entry: AuditEntry): Promise<void> {
    this.store.push(clone(entry));
  }

  async listByCase(caseId: string): Promise<AuditEntry[]> {
    return this.store.filter((e) => e.caseId === caseId).map(clone);
  }
}

export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async save(key: string, _endpoint: string, responseJson: string): Promise<void> {
    this.store.set(key, responseJson);
  }
}
