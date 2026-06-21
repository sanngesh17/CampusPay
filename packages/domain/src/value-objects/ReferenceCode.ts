import { DomainError } from '../errors/DomainError';

/**
 * University payment reference, validated against an institution-specific rule.
 * The rule (a RegExp) is supplied by the beneficiary directory record, so reference
 * formats stay config-driven rather than hard-coded.
 */
export class ReferenceCode {
  private constructor(public readonly value: string) {}

  static create(raw: string, rule: RegExp): ReferenceCode {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new DomainError('Reference code cannot be empty', 'REFERENCE_EMPTY');
    }
    if (!rule.test(trimmed)) {
      throw new DomainError(
        `Reference code "${trimmed}" does not match the institution rule`,
        'REFERENCE_INVALID',
      );
    }
    return new ReferenceCode(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
