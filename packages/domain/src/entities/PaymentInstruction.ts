import type { Money } from '../value-objects/Money';
import type { ReferenceCode } from '../value-objects/ReferenceCode';
import type { CaseId, PaymentInstructionId } from '../value-objects/ids';
import type { UniversityRef } from './University';

export interface PaymentInstructionProps {
  readonly id: PaymentInstructionId;
  readonly caseId: CaseId;
  readonly amount: Money;
  readonly beneficiary: UniversityRef;
  readonly reference: ReferenceCode;
  /** Idempotency key carried end-to-end so a retried initiate never double-pays. */
  readonly idempotencyKey: string;
}

export class PaymentInstruction {
  readonly id: PaymentInstructionId;
  readonly caseId: CaseId;
  readonly amount: Money;
  readonly beneficiary: UniversityRef;
  readonly reference: ReferenceCode;
  readonly idempotencyKey: string;

  constructor(props: PaymentInstructionProps) {
    this.id = props.id;
    this.caseId = props.caseId;
    this.amount = props.amount;
    this.beneficiary = props.beneficiary;
    this.reference = props.reference;
    this.idempotencyKey = props.idempotencyKey;
  }
}
