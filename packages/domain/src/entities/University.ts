import type { Currency } from '../value-objects/Currency';
import type { UniversityId } from '../value-objects/ids';

export interface UniversityRef {
  readonly id: UniversityId;
  readonly name: string;
}

export interface UniversityProps {
  readonly id: UniversityId;
  readonly name: string;
  readonly country: string;
  readonly currency: Currency;
  /** RegExp source string for institution-specific reference validation (config-driven). */
  readonly referenceRule: string;
  /** Pseudonymous beneficiary directory reference — never a raw bank account number. */
  readonly beneficiaryRef: string;
}

/** Beneficiary directory record. */
export class University {
  readonly id: UniversityId;
  readonly name: string;
  readonly country: string;
  readonly currency: Currency;
  readonly referenceRule: string;
  readonly beneficiaryRef: string;

  constructor(props: UniversityProps) {
    this.id = props.id;
    this.name = props.name;
    this.country = props.country;
    this.currency = props.currency;
    this.referenceRule = props.referenceRule;
    this.beneficiaryRef = props.beneficiaryRef;
  }

  referenceRegex(): RegExp {
    return new RegExp(this.referenceRule);
  }

  toRef(): UniversityRef {
    return { id: this.id, name: this.name };
  }
}
