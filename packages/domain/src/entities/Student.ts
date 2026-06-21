import type { StudentId } from '../value-objects/ids';

/** Lightweight reference embedded in a TuitionCase (no PII beyond a display name). */
export interface StudentRef {
  readonly id: StudentId;
  readonly displayName: string;
}

export interface StudentProps {
  readonly id: StudentId;
  readonly fullName: string;
  readonly email: string;
  readonly countryOfStudy: string;
}

/**
 * Student entity. Sensitive PII (pan/passport/bankAccount) is NOT carried here as plaintext —
 * it is field-level encrypted at the persistence layer (apps/api). The domain holds only
 * non-sensitive identity and references.
 */
export class Student {
  readonly id: StudentId;
  readonly fullName: string;
  readonly email: string;
  readonly countryOfStudy: string;

  constructor(props: StudentProps) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.email = props.email;
    this.countryOfStudy = props.countryOfStudy;
  }

  toRef(): StudentRef {
    return { id: this.id, displayName: this.fullName };
  }
}
