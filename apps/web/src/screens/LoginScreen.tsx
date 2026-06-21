import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../auth/demoAccounts';
import { Button, Card, ErrorNote, Field, TextInput } from '../components/ui';

export function LoginScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0]!.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState('');
  const [roleOpen, setRoleOpen] = useState(false);
  const selectedAccount =
    DEMO_ACCOUNTS.find((account) => account.email === email) ?? DEMO_ACCOUNTS[0]!;

  if (auth.user) return <Navigate to="/dashboard" replace />;

  async function login() {
    try {
      setError('');
      await auth.login(email, password);
      navigate('/dashboard');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <>
      <header className="login-header">
        <span className="eyebrow">Secure sign-in</span>
        <h1>
          Sign in to <span>CampusPay</span>
        </h1>
        <p>Access your payment workspace.</p>
      </header>

      <Card className="mx-auto w-full max-w-[460px] p-5 sm:p-6">
        <div className="grid gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
              Choose account
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Select the account type for this environment.
            </p>
            <div className="mt-5">
              <Field label="Sign in as">
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={roleOpen}
                    className="tf-input flex items-center justify-between text-left"
                    onClick={() => setRoleOpen((current) => !current)}
                  >
                    <span>{selectedAccount.label}</span>
                    <span className="font-mono text-[11px] text-[var(--ink-faint)]">⌄</span>
                  </button>
                  {roleOpen ? (
                    <div
                      role="listbox"
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_14px_32px_rgba(32,32,32,0.10)]"
                    >
                      {DEMO_ACCOUNTS.map((account) => (
                        <button
                          key={account.email}
                          type="button"
                          role="option"
                          aria-selected={account.email === email}
                          className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                            account.email === email
                              ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                              : 'text-[var(--ink)] hover:bg-[rgba(32,32,32,0.03)]'
                          }`}
                          onClick={() => {
                            setEmail(account.email);
                            setRoleOpen(false);
                          }}
                        >
                          <span>{account.label}</span>
                          {account.email === email ? (
                            <span className="font-mono text-[11px]">selected</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Field>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Email">
              <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <ErrorNote message={error} />
            <Button className="w-full" onClick={() => void login()}>
              Sign in &rarr;
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
