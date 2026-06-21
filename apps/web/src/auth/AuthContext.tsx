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

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const DATA_BACKEND = (import.meta.env.VITE_DATA_BACKEND as string | undefined) ?? 'firestore';
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
        if (DATA_BACKEND === 'firestore') {
          const authenticated = authenticateDemoAccount(email, password);
          const accessToken = `firestore:${authenticated.id}:${Date.now()}`;
          sessionStorage.setItem(TOKEN_KEY, accessToken);
          sessionStorage.setItem(USER_KEY, JSON.stringify(authenticated));
          setToken(accessToken);
          setUser(authenticated);
          return;
        }
        const response = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) throw new Error('Invalid email or password');
        const body = (await jsonResponse(response)) as { accessToken: string; user: AuthUser };
        sessionStorage.setItem(TOKEN_KEY, body.accessToken);
        sessionStorage.setItem(USER_KEY, JSON.stringify(body.user));
        setToken(body.accessToken);
        setUser(body.user);
      },
      logout() {
        if (DATA_BACKEND !== 'firestore') {
          void fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        }
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

async function jsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'API is not configured for this deployment. Set VITE_API_URL to the hosted API URL.',
    );
  }
  return response.json();
}

export function useAuth(): AuthState {
  const value = use(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
