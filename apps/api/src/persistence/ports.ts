import type {
  AttestationRecord,
  AuditEntry,
  StoredCase,
  StoredLender,
  StoredStudent,
  StoredUniversity,
} from './records';

export interface CaseRepository {
  create(record: StoredCase): Promise<void>;
  findById(id: string): Promise<StoredCase | null>;
  save(record: StoredCase): Promise<void>;
  list(): Promise<StoredCase[]>;
}

export interface StudentRepository {
  upsert(record: StoredStudent): Promise<void>;
  findById(id: string): Promise<StoredStudent | null>;
}

export interface LenderRepository {
  upsert(record: StoredLender): Promise<void>;
  findById(id: string): Promise<StoredLender | null>;
}

export interface BeneficiaryRepository {
  upsert(record: StoredUniversity): Promise<void>;
  findById(id: string): Promise<StoredUniversity | null>;
  list(): Promise<StoredUniversity[]>;
}

export interface AttestationRepository {
  add(record: AttestationRecord): Promise<void>;
  listByCase(caseId: string): Promise<AttestationRecord[]>;
}

export interface AuditRepository {
  add(entry: AuditEntry): Promise<void>;
  listByCase(caseId: string): Promise<AuditEntry[]>;
}

export interface IdempotencyRepository {
  get(key: string): Promise<string | null>;
  save(key: string, endpoint: string, responseJson: string): Promise<void>;
}
