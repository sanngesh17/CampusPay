import type { AuthUser } from './AuthContext';

export interface DemoAccount {
  label: string;
  email: string;
  user: AuthUser;
}

export const DEMO_PASSWORD = 'DemoPass123!';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'Student',
    email: 'student@tuitionflow.local',
    user: {
      id: 'student-a',
      email: 'student@tuitionflow.local',
      displayName: 'Aarav Sharma',
      role: 'STUDENT',
      universityName: 'University of Warwick',
    },
  },
  {
    label: 'University finance',
    email: 'finance-warwick@tuitionflow.local',
    user: {
      id: 'finance-warwick',
      email: 'finance-warwick@tuitionflow.local',
      displayName: 'University of Warwick Finance',
      role: 'UNIVERSITY_FINANCE',
      universityName: 'University of Warwick',
    },
  },
  {
    label: 'Lender officer',
    email: 'lender@tuitionflow.local',
    user: {
      id: 'lender-sbi-officer',
      email: 'lender@tuitionflow.local',
      displayName: 'SBI Disbursement Officer',
      role: 'LENDER_OFFICER',
      lenderId: 'lender-sbi',
    },
  },
  {
    label: 'Payment ops',
    email: 'ops@tuitionflow.local',
    user: {
      id: 'ops-1',
      email: 'ops@tuitionflow.local',
      displayName: 'CampusPay Payment Operations',
      role: 'PAYMENT_OPS',
    },
  },
];

export function authenticateDemoAccount(email: string, password: string): AuthUser {
  const account = DEMO_ACCOUNTS.find((item) => item.email === email.toLowerCase());
  if (!account || password !== DEMO_PASSWORD) throw new Error('Invalid email or password');
  return account.user;
}
