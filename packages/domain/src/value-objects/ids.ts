import { randomUUID } from 'node:crypto';

/**
 * Branded id types — opaque strings that are not interchangeable at the type level
 * (a `StudentId` cannot be passed where a `CaseId` is expected). Each id exposes
 * `create(raw)` (wrap an existing value) and `generate()` (mint a new UUID).
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type CaseId = Brand<string, 'CaseId'>;
export type StudentId = Brand<string, 'StudentId'>;
export type LenderId = Brand<string, 'LenderId'>;
export type UniversityId = Brand<string, 'UniversityId'>;
export type QuoteId = Brand<string, 'QuoteId'>;
export type AttestationId = Brand<string, 'AttestationId'>;
export type CredentialId = Brand<string, 'CredentialId'>;
export type PaymentInstructionId = Brand<string, 'PaymentInstructionId'>;

interface IdFactory<T extends string> {
  create(raw: string): T;
  generate(): T;
}

function idFactory<T extends string>(): IdFactory<T> {
  return {
    create: (raw: string): T => raw as T,
    generate: (): T => randomUUID() as T,
  };
}

export const CaseId = idFactory<CaseId>();
export const StudentId = idFactory<StudentId>();
export const LenderId = idFactory<LenderId>();
export const UniversityId = idFactory<UniversityId>();
export const QuoteId = idFactory<QuoteId>();
export const AttestationId = idFactory<AttestationId>();
export const CredentialId = idFactory<CredentialId>();
export const PaymentInstructionId = idFactory<PaymentInstructionId>();
