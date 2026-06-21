import { DomainError } from '../errors/DomainError';
import { ReferenceCode } from './ReferenceCode';

const rule = /^UNI-[0-9]{6}$/;

describe('ReferenceCode', () => {
  it('accepts a valid reference', () => {
    expect(ReferenceCode.create('UNI-123456', rule).value).toBe('UNI-123456');
  });

  it('trims before validating', () => {
    expect(ReferenceCode.create('  UNI-123456 ', rule).value).toBe('UNI-123456');
  });

  it('rejects empty and non-matching references', () => {
    expect(() => ReferenceCode.create('   ', rule)).toThrow(DomainError);
    expect(() => ReferenceCode.create('BAD', rule)).toThrow(/does not match/);
  });
});
