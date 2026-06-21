import type { CredentialId } from '../value-objects/ids';

export type CredentialStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface CounterpartyCredentialProps {
  readonly id: CredentialId;
  /** Counterparty XRPL address or pseudonymous reference — not PII. */
  readonly subject: string;
  /** e.g. 'LENDER_VETTED', 'UNIVERSITY_VETTED', 'PARTNER_VETTED'. */
  readonly credentialType: string;
  readonly status: CredentialStatus;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
}

/** Domain view of an XLS-70 credential used to vet lenders / universities / partners. */
export class CounterpartyCredential {
  readonly id: CredentialId;
  readonly subject: string;
  readonly credentialType: string;
  readonly status: CredentialStatus;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;

  constructor(props: CounterpartyCredentialProps) {
    this.id = props.id;
    this.subject = props.subject;
    this.credentialType = props.credentialType;
    this.status = props.status;
    this.issuedAt = props.issuedAt;
    if (props.expiresAt !== undefined) this.expiresAt = props.expiresAt;
  }

  isValid(now: Date = new Date()): boolean {
    if (this.status !== 'ACCEPTED') return false;
    if (this.expiresAt !== undefined && now.getTime() >= this.expiresAt.getTime()) return false;
    return true;
  }
}
