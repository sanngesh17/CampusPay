import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import type { AppConfig } from '../config/app-config';
import {
  APP_CONFIG,
  ATTESTATION_REPOSITORY,
  AUDIT_REPOSITORY,
  BENEFICIARY_REPOSITORY,
  CASE_REPOSITORY,
  IDEMPOTENCY_REPOSITORY,
  LENDER_REPOSITORY,
  STUDENT_REPOSITORY,
  PRISMA_CLIENT,
} from '../tokens';
import * as memory from './memory/in-memory.repositories';
import type {
  AttestationRepository,
  AuditRepository,
  BeneficiaryRepository,
  CaseRepository,
  IdempotencyRepository,
  LenderRepository,
  StudentRepository,
} from './ports';

type Db = import('@prisma/client').PrismaClient;

const prismaClientProvider: Provider = {
  provide: PRISMA_CLIENT,
  inject: [APP_CONFIG],
  useFactory: async (config: AppConfig): Promise<Db | null> => {
    if (config.persistence !== 'prisma') return null;
    const { PrismaClient } = await import('@prisma/client');
    const client = new PrismaClient();
    await client.$connect();
    return client;
  },
};

function repoProvider<T>(
  token: symbol,
  memoryFactory: () => T,
  prismaFactory: (db: Db) => Promise<T>,
): Provider {
  return {
    provide: token,
    inject: [APP_CONFIG, PRISMA_CLIENT],
    useFactory: async (config: AppConfig, db: Db | null): Promise<T> => {
      if (config.persistence === 'prisma' && db) return prismaFactory(db);
      return memoryFactory();
    },
  };
}

const prisma = (): Promise<typeof import('./prisma/prisma.repositories')> =>
  import('./prisma/prisma.repositories');

/**
 * Binds repository ports to implementations chosen at runtime: in-memory by default (fast, no DB),
 * Prisma when PERSISTENCE=prisma. The Prisma layer is dynamically imported only in prisma mode, so
 * memory mode never loads @prisma/client.
 */
@Global()
@Module({})
export class PersistenceModule {
  static register(): DynamicModule {
    const providers: Provider[] = [
      prismaClientProvider,
      repoProvider<CaseRepository>(
        CASE_REPOSITORY,
        () => new memory.InMemoryCaseRepository(),
        async (db) => new (await prisma()).PrismaCaseRepository(db),
      ),
      repoProvider<StudentRepository>(
        STUDENT_REPOSITORY,
        () => new memory.InMemoryStudentRepository(),
        async (db) => new (await prisma()).PrismaStudentRepository(db),
      ),
      repoProvider<LenderRepository>(
        LENDER_REPOSITORY,
        () => new memory.InMemoryLenderRepository(),
        async (db) => new (await prisma()).PrismaLenderRepository(db),
      ),
      repoProvider<BeneficiaryRepository>(
        BENEFICIARY_REPOSITORY,
        () => new memory.InMemoryBeneficiaryRepository(),
        async (db) => new (await prisma()).PrismaBeneficiaryRepository(db),
      ),
      repoProvider<AttestationRepository>(
        ATTESTATION_REPOSITORY,
        () => new memory.InMemoryAttestationRepository(),
        async (db) => new (await prisma()).PrismaAttestationRepository(db),
      ),
      repoProvider<AuditRepository>(
        AUDIT_REPOSITORY,
        () => new memory.InMemoryAuditRepository(),
        async (db) => new (await prisma()).PrismaAuditRepository(db),
      ),
      repoProvider<IdempotencyRepository>(
        IDEMPOTENCY_REPOSITORY,
        () => new memory.InMemoryIdempotencyRepository(),
        async (db) => new (await prisma()).PrismaIdempotencyRepository(db),
      ),
    ];
    return {
      module: PersistenceModule,
      providers,
      exports: [
        CASE_REPOSITORY,
        STUDENT_REPOSITORY,
        LENDER_REPOSITORY,
        BENEFICIARY_REPOSITORY,
        ATTESTATION_REPOSITORY,
        AUDIT_REPOSITORY,
        IDEMPOTENCY_REPOSITORY,
        PRISMA_CLIENT,
      ],
    };
  }
}
