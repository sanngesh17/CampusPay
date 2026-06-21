import type { LenderId } from '../value-objects/ids';

export type LenderType = 'BANK' | 'NBFC';

export interface LenderRef {
  readonly id: LenderId;
  readonly name: string;
}

export interface LenderProps {
  readonly id: LenderId;
  readonly name: string;
  readonly type: LenderType;
}

export class Lender {
  readonly id: LenderId;
  readonly name: string;
  readonly type: LenderType;

  constructor(props: LenderProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
  }

  toRef(): LenderRef {
    return { id: this.id, name: this.name };
  }
}
