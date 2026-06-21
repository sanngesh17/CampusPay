import type { Currency } from '../api/types';

export interface PersonaOption {
  id: string;
  name: string;
  country: string;
  blurb: string;
}

export const STUDENTS: PersonaOption[] = [
  {
    id: 'student-a',
    name: 'Aarav Sharma',
    country: 'United Kingdom',
    blurb: 'SBI education loan · integrated',
  },
  {
    id: 'student-b',
    name: 'Diya Patel',
    country: 'United States',
    blurb: 'NBFC loan · direct to university',
  },
];

export const LENDERS = [
  { id: 'lender-sbi', name: 'State Bank of India', type: 'BANK' },
  { id: 'lender-nbfc', name: 'Avanse Financial Services', type: 'NBFC' },
];

export interface BeneficiaryOption {
  id: string;
  name: string;
  currency: Currency;
  referenceHint: string;
}

export const BENEFICIARIES: BeneficiaryOption[] = [
  { id: 'uni-oxford', name: 'University of Oxford', currency: 'GBP', referenceHint: 'OX-123456' },
  {
    id: 'uni-mit',
    name: 'Massachusetts Institute of Technology',
    currency: 'USD',
    referenceHint: 'MIT-654321',
  },
  {
    id: 'uni-imperial',
    name: 'Imperial College London',
    currency: 'GBP',
    referenceHint: 'IMP-200145',
  },
];

/** Statuses considered "finished" for UI purposes. */
export const TERMINAL_STATUSES = new Set(['RECONCILED', 'FAILED', 'REFUND_INITIATED']);
