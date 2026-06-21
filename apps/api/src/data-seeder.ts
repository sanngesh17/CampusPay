import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { FieldCipher } from './common/crypto/field-cipher';
import type { AppConfig } from './config/app-config';
import type {
  BeneficiaryRepository,
  LenderRepository,
  StudentRepository,
} from './persistence/ports';
import { SEED_LENDERS, SEED_STUDENTS, SEED_UNIVERSITIES } from './seed-data';
import {
  APP_CONFIG,
  BENEFICIARY_REPOSITORY,
  FIELD_CIPHER,
  LENDER_REPOSITORY,
  STUDENT_REPOSITORY,
} from './tokens';

/** Seeds the in-memory store with the demo personas + beneficiaries (PII encrypted at rest). In
 * prisma mode the DB is seeded by prisma/seed.ts instead. */
@Injectable()
export class DataSeeder implements OnModuleInit {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FIELD_CIPHER) private readonly cipher: FieldCipher,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(LENDER_REPOSITORY) private readonly lenders: LenderRepository,
    @Inject(BENEFICIARY_REPOSITORY) private readonly beneficiaries: BeneficiaryRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.persistence !== 'memory') return;

    for (const s of SEED_STUDENTS) {
      await this.students.upsert({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        countryOfStudy: s.countryOfStudy,
        panCipher: this.cipher.encrypt(s.pan),
        passportCipher: this.cipher.encrypt(s.passport),
        bankAccountCipher: this.cipher.encrypt(s.bankAccount),
        keyRef: 'local',
      });
    }
    for (const l of SEED_LENDERS) {
      await this.lenders.upsert({ id: l.id, name: l.name, type: l.type });
    }
    for (const u of SEED_UNIVERSITIES) {
      await this.beneficiaries.upsert({ ...u });
    }
  }
}
