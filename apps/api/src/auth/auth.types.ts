export type UserRole = 'STUDENT' | 'LENDER_OFFICER' | 'PAYMENT_OPS';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly lenderId?: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
}
