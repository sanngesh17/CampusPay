import { DomainError, IllegalTransition } from '../errors/DomainError';

export enum RemittanceStatus {
  DRAFT = 'DRAFT',
  EVIDENCE_SUBMITTED = 'EVIDENCE_SUBMITTED',
  COMPLIANCE_PENDING = 'COMPLIANCE_PENDING',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  INSTRUCTION_ISSUED = 'INSTRUCTION_ISSUED',
  FUNDING_PENDING = 'FUNDING_PENDING',
  FUNDS_RECEIVED = 'FUNDS_RECEIVED',
  PAYOUT_SUBMITTED = 'PAYOUT_SUBMITTED',
  VALIDATING = 'VALIDATING',
  TRANSFERRING = 'TRANSFERRING',
  COMPLETED = 'COMPLETED',
  RECONCILED = 'RECONCILED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUND_PENDING = 'REFUND_PENDING',
}

export type RemittanceFundingType = 'FULL_LOAN' | 'PARTIAL_LOAN' | 'SELF_FUNDED';
export type FundingLegKind = 'LENDER' | 'STUDENT';

export interface FundingLeg {
  readonly kind: FundingLegKind;
  readonly requiredMinor: bigint;
  readonly receivedMinor: bigint;
  readonly transferReference?: string;
}

export interface RemittanceCaseProps {
  readonly id: string;
  readonly studentId: string;
  readonly studentAge: number;
  readonly fundingType: RemittanceFundingType;
  readonly sourceAmountMinor: bigint;
  readonly currency: 'INR';
  readonly lenderAmountMinor?: bigint;
}

const PAYOUT_TRANSITIONS: Readonly<Record<RemittanceStatus, readonly RemittanceStatus[]>> = {
  [RemittanceStatus.DRAFT]: [RemittanceStatus.EVIDENCE_SUBMITTED, RemittanceStatus.CANCELLED],
  [RemittanceStatus.EVIDENCE_SUBMITTED]: [
    RemittanceStatus.COMPLIANCE_PENDING,
    RemittanceStatus.CHANGES_REQUESTED,
    RemittanceStatus.REJECTED,
  ],
  [RemittanceStatus.COMPLIANCE_PENDING]: [
    RemittanceStatus.INSTRUCTION_ISSUED,
    RemittanceStatus.CHANGES_REQUESTED,
    RemittanceStatus.REJECTED,
    RemittanceStatus.FAILED,
  ],
  [RemittanceStatus.CHANGES_REQUESTED]: [
    RemittanceStatus.EVIDENCE_SUBMITTED,
    RemittanceStatus.CANCELLED,
  ],
  [RemittanceStatus.INSTRUCTION_ISSUED]: [
    RemittanceStatus.FUNDING_PENDING,
    RemittanceStatus.EXPIRED,
    RemittanceStatus.CANCELLED,
  ],
  [RemittanceStatus.FUNDING_PENDING]: [
    RemittanceStatus.FUNDS_RECEIVED,
    RemittanceStatus.CHANGES_REQUESTED,
    RemittanceStatus.REJECTED,
    RemittanceStatus.EXPIRED,
    RemittanceStatus.CANCELLED,
  ],
  [RemittanceStatus.FUNDS_RECEIVED]: [
    RemittanceStatus.PAYOUT_SUBMITTED,
    RemittanceStatus.REFUND_PENDING,
    RemittanceStatus.FAILED,
  ],
  [RemittanceStatus.PAYOUT_SUBMITTED]: [RemittanceStatus.VALIDATING, RemittanceStatus.FAILED],
  [RemittanceStatus.VALIDATING]: [RemittanceStatus.TRANSFERRING, RemittanceStatus.FAILED],
  [RemittanceStatus.TRANSFERRING]: [RemittanceStatus.COMPLETED, RemittanceStatus.FAILED],
  [RemittanceStatus.COMPLETED]: [RemittanceStatus.RECONCILED, RemittanceStatus.REFUND_PENDING],
  [RemittanceStatus.RECONCILED]: [RemittanceStatus.REFUND_PENDING],
  [RemittanceStatus.REJECTED]: [],
  [RemittanceStatus.EXPIRED]: [],
  [RemittanceStatus.FAILED]: [RemittanceStatus.REFUND_PENDING],
  [RemittanceStatus.CANCELLED]: [],
  [RemittanceStatus.REFUND_PENDING]: [],
};

export class RemittanceCase {
  readonly id: string;
  readonly studentId: string;
  readonly fundingType: RemittanceFundingType;
  readonly sourceAmountMinor: bigint;
  readonly currency: 'INR';
  private _status = RemittanceStatus.DRAFT;
  private _fundingLegs: FundingLeg[];

  constructor(props: RemittanceCaseProps) {
    if (props.studentAge < 18)
      throw new DomainError('Applicant must be at least 18', 'MINOR_NOT_SUPPORTED');
    if (props.sourceAmountMinor <= 0n)
      throw new DomainError('Amount must be positive', 'INVALID_AMOUNT');
    const lender = props.lenderAmountMinor ?? 0n;
    if (lender < 0n || lender > props.sourceAmountMinor)
      throw new DomainError('Invalid lender amount', 'INVALID_FUNDING_SPLIT');
    if (props.fundingType === 'FULL_LOAN' && lender !== props.sourceAmountMinor)
      throw new DomainError('Full loan must cover the entire amount', 'INVALID_FUNDING_SPLIT');
    if (
      props.fundingType === 'PARTIAL_LOAN' &&
      (lender === 0n || lender === props.sourceAmountMinor)
    )
      throw new DomainError(
        'Partial loan requires lender and student funding',
        'INVALID_FUNDING_SPLIT',
      );
    if (props.fundingType === 'SELF_FUNDED' && lender !== 0n)
      throw new DomainError(
        'Self-funded case cannot include lender funds',
        'INVALID_FUNDING_SPLIT',
      );

    this.id = props.id;
    this.studentId = props.studentId;
    this.fundingType = props.fundingType;
    this.sourceAmountMinor = props.sourceAmountMinor;
    this.currency = props.currency;
    this._fundingLegs = [
      ...(lender > 0n
        ? [{ kind: 'LENDER' as const, requiredMinor: lender, receivedMinor: 0n }]
        : []),
      ...(props.sourceAmountMinor - lender > 0n
        ? [
            {
              kind: 'STUDENT' as const,
              requiredMinor: props.sourceAmountMinor - lender,
              receivedMinor: 0n,
            },
          ]
        : []),
    ];
  }

  static rehydrate(
    props: RemittanceCaseProps,
    status: RemittanceStatus,
    fundingLegs: readonly FundingLeg[],
  ): RemittanceCase {
    const result = new RemittanceCase(props);
    result._status = status;
    result._fundingLegs = fundingLegs.map((leg) => ({ ...leg }));
    return result;
  }

  get status(): RemittanceStatus {
    return this._status;
  }
  get fundingLegs(): readonly FundingLeg[] {
    return this._fundingLegs;
  }

  transition(to: RemittanceStatus): void {
    if (!PAYOUT_TRANSITIONS[this._status].includes(to))
      throw new IllegalTransition(this._status, to);
    if (to === RemittanceStatus.FUNDS_RECEIVED && !this.isFullyFunded())
      throw new DomainError('All funding legs must be received', 'FUNDING_INCOMPLETE');
    this._status = to;
  }

  recordFunding(kind: FundingLegKind, amountMinor: bigint, transferReference: string): void {
    if (this._status !== RemittanceStatus.FUNDING_PENDING)
      throw new IllegalTransition(this._status, RemittanceStatus.FUNDS_RECEIVED);
    const leg = this._fundingLegs.find((item) => item.kind === kind);
    if (!leg)
      throw new DomainError(`Funding leg ${kind} is not required`, 'FUNDING_LEG_NOT_REQUIRED');
    if (amountMinor !== leg.requiredMinor)
      throw new DomainError(
        'Funding amount must match the required leg',
        'FUNDING_AMOUNT_MISMATCH',
      );
    this._fundingLegs = this._fundingLegs.map((item) =>
      item.kind === kind ? { ...item, receivedMinor: amountMinor, transferReference } : item,
    );
  }

  isFullyFunded(): boolean {
    return this._fundingLegs.every((leg) => leg.receivedMinor === leg.requiredMinor);
  }
}
