import type { Currency } from '@tuitionflow/domain';

/** The two demo personas, their lenders, and a small beneficiary set (memory seed). The Prisma seed
 * (prisma/seed.ts) expands the beneficiary directory to 50 rows. Stable ids let tests reference them. */

export interface SeedStudent {
  id: string;
  fullName: string;
  email: string;
  countryOfStudy: string;
  pan: string;
  passport: string;
  bankAccount: string;
}

export interface SeedLender {
  id: string;
  name: string;
  type: 'BANK' | 'NBFC';
}

export interface SeedUniversity {
  id: string;
  name: string;
  country: string;
  currency: Currency;
  referenceRule: string;
  beneficiaryRef: string;
}

export const SEED_STUDENTS: readonly SeedStudent[] = [
  {
    id: 'student-a',
    fullName: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    countryOfStudy: 'UK',
    pan: 'ABCDE1234F',
    passport: 'P1234567',
    bankAccount: '00012345678',
  },
  {
    id: 'student-b',
    fullName: 'Diya Patel',
    email: 'diya.patel@example.com',
    countryOfStudy: 'US',
    pan: 'PQRSX6789T',
    passport: 'N7654321',
    bankAccount: '00098765432',
  },
];

export const SEED_LENDERS: readonly SeedLender[] = [
  { id: 'lender-sbi', name: 'State Bank of India', type: 'BANK' },
  { id: 'lender-nbfc', name: 'Avanse Financial Services', type: 'NBFC' },
];

export const SEED_UNIVERSITIES: readonly SeedUniversity[] = [
  {
    id: 'uni-oxford',
    name: 'University of Oxford',
    country: 'UK',
    currency: 'GBP',
    referenceRule: '^OX-[0-9]{6}$',
    beneficiaryRef: 'BEN-OX-001',
  },
  {
    id: 'uni-mit',
    name: 'Massachusetts Institute of Technology',
    country: 'US',
    currency: 'USD',
    referenceRule: '^MIT-[0-9]{6}$',
    beneficiaryRef: 'BEN-MIT-001',
  },
  {
    id: 'uni-imperial',
    name: 'Imperial College London',
    country: 'UK',
    currency: 'GBP',
    referenceRule: '^IMP-[0-9]{6}$',
    beneficiaryRef: 'BEN-IMP-001',
  },
];
