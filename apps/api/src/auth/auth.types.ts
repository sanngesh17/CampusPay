export type UserRole = 'STUDENT' | 'LENDER_OFFICER' | 'PAYMENT_OPS' | 'UNIVERSITY_FINANCE';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly lenderId?: string;
  readonly universityName?: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
}
