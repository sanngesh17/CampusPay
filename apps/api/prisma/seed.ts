import type { PrismaClient } from '@prisma/client';
import { FieldCipher } from '../src/common/crypto/field-cipher';
import { loadAppConfig } from '../src/config/app-config';
import { SEED_LENDERS, SEED_STUDENTS, SEED_UNIVERSITIES } from '../src/seed-data';

/** Seeds the database with the two demo personas and a 50-row beneficiary directory. Sensitive PII
 * is field-level encrypted before it is written — the DB stores ciphertext only. */
async function createPrismaClient(): Promise<PrismaClient> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed Prisma');
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function main(): Promise<void> {
  const prisma = await createPrismaClient();
  const cipher = new FieldCipher(loadAppConfig().encryptionKey);

  for (const s of SEED_STUDENTS) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        countryOfStudy: s.countryOfStudy,
        panCipher: cipher.encrypt(s.pan),
        passportCipher: cipher.encrypt(s.passport),
        bankAccountCipher: cipher.encrypt(s.bankAccount),
        keyRef: 'local',
      },
    });
  }

  for (const l of SEED_LENDERS) {
    await prisma.lender.upsert({
      where: { id: l.id },
      update: {},
      create: { id: l.id, name: l.name, type: l.type },
    });
  }

  for (const u of SEED_UNIVERSITIES) {
    await prisma.university.upsert({ where: { id: u.id }, update: {}, create: { ...u } });
  }
  // Pad the beneficiary directory to 50 rows.
  for (let i = 1; i <= 50 - SEED_UNIVERSITIES.length; i += 1) {
    const id = `uni-gen-${i}`;
    const isUk = i % 2 === 1;
    await prisma.university.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: `Partner University ${i}`,
        country: isUk ? 'UK' : 'US',
        currency: isUk ? 'GBP' : 'USD',
        referenceRule: `^PU${i}-[0-9]{6}$`,
        beneficiaryRef: `BEN-PU-${i}`,
      },
    });
  }

  const total = await prisma.university.count();
  console.log(
    `Seed complete: ${SEED_STUDENTS.length} students, ${SEED_LENDERS.length} lenders, ${total} beneficiaries`,
  );
  await prisma.$disconnect();
}

void main();
