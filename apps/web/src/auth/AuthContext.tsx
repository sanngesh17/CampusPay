import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { authenticateDemoAccount } from './demoAccounts';

export type UserRole = 'STUDENT' | 'LENDER_OFFICER' | 'PAYMENT_OPS' | 'UNIVERSITY_FINANCE';
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  lenderId?: string;
  universityName?: string;
}
interface AuthState {
  user?: AuthUser;
  token?: string;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const TOKEN_KEY = 'tf_token:v1';
const USER_KEY = 'tf_user:v1';
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(
    () => sessionStorage.getItem(TOKEN_KEY) ?? undefined,
  );
  const [user, setUser] = useState<AuthUser | undefined>(() => {
    const value = sessionStorage.getItem(USER_KEY);
    return value ? (JSON.parse(value) as AuthUser) : undefined;
  });
  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      async login(email: string, password: string) {
        const authenticated = authenticateDemoAccount(email, password);
        const accessToken = `firestore:${authenticated.id}:${Date.now()}`;
        sessionStorage.setItem(TOKEN_KEY, accessToken);
        sessionStorage.setItem(USER_KEY, JSON.stringify(authenticated));
        setToken(accessToken);
        setUser(authenticated);
      },
      logout() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        setToken(undefined);
        setUser(undefined);
      },
    }),
    [token, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = use(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
